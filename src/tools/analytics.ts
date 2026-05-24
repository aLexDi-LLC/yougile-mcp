import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { YouGileClient } from "../api/client.js";
import type { YGBoard, YGColumn, YGProject, YGTask, PaginatedResponse } from "../api/types.js";

export function registerAnalyticsTools(
  server: McpServer,
  client: YouGileClient
): void {
  server.tool(
    "board_summary",
    "Get analytics summary for a board: task counts per column, completed ratio, overdue tasks, unassigned tasks. Makes multiple API calls (1 + N columns).",
    { boardId: z.string().describe("Board ID") },
    async ({ boardId }) => {
      const columns = await client.getPaginated<YGColumn>("/columns", {
        boardId,
      });

      let totalTasks = 0;
      let completedCount = 0;
      let overdueCount = 0;
      let unassignedCount = 0;
      const now = Date.now();

      const columnStats: Array<{
        id: string;
        title: string;
        taskCount: number;
      }> = [];

      for (const col of columns) {
        const tasks = await client.getPaginated<YGTask>("/tasks", {
          columnId: col.id,
        });

        columnStats.push({
          id: col.id,
          title: col.title,
          taskCount: tasks.length,
        });

        totalTasks += tasks.length;
        for (const t of tasks) {
          if (t.completed) completedCount++;
          if (
            t.deadline?.timestamp &&
            t.deadline.timestamp < now &&
            !t.completed
          )
            overdueCount++;
          if (!t.assigned || t.assigned.length === 0) unassignedCount++;
        }
      }

      const summary = {
        boardId,
        totalTasks,
        completedCount,
        completedRatio:
          totalTasks > 0
            ? `${Math.round((completedCount / totalTasks) * 100)}%`
            : "N/A",
        overdueCount,
        unassignedCount,
        columns: columnStats,
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(summary, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "my_tasks",
    "Get all tasks assigned to a user, grouped by status (overdue, in_progress, completed, unscheduled). Provide userId or set YOUGILE_USER_ID env var.",
    {
      userId: z
        .string()
        .optional()
        .describe("User ID. Falls back to YOUGILE_USER_ID env var."),
    },
    async ({ userId }) => {
      const uid = userId || process.env.YOUGILE_USER_ID;
      if (!uid) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: userId is required. Pass it as parameter or set YOUGILE_USER_ID env var. Use list_users to find your user ID.",
            },
          ],
          isError: true,
        };
      }

      // /users/{id}/tasks returns 404 in YouGile API v2 — use list_tasks with assignedTo filter instead
      const tasks = await client.getPaginated<YGTask>("/tasks", { assignedTo: uid });

      const now = Date.now();
      const overdue: YGTask[] = [];
      const inProgress: YGTask[] = [];
      const completed: YGTask[] = [];
      const unscheduled: YGTask[] = [];

      for (const t of tasks) {
        if (t.completed) {
          completed.push(t);
        } else if (
          t.deadline?.timestamp &&
          t.deadline.timestamp < now
        ) {
          overdue.push(t);
        } else if (t.deadline?.timestamp) {
          inProgress.push(t);
        } else {
          unscheduled.push(t);
        }
      }

      const fmt = (list: YGTask[]) =>
        list.map((t) => ({
          id: t.id,
          title: t.title,
          deadline: t.deadline
            ? new Date(t.deadline.timestamp).toISOString()
            : null,
          stickers: t.stickers,
        }));

      const result = {
        userId: uid,
        totalTasks: tasks.length,
        summary: {
          overdue: overdue.length,
          inProgress: inProgress.length,
          completed: completed.length,
          unscheduled: unscheduled.length,
        },
        overdue: fmt(overdue),
        inProgress: fmt(inProgress),
        completed: fmt(completed),
        unscheduled: fmt(unscheduled),
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "overdue_tasks",
    "Find overdue tasks (past deadline, not completed) on a board. Returns tasks sorted by how overdue they are.",
    { boardId: z.string().describe("Board ID to scan for overdue tasks") },
    async ({ boardId }) => {
      const columns = await client.getPaginated<YGColumn>("/columns", {
        boardId,
      });

      const now = Date.now();
      const overdue: Array<{
        id: string;
        title: string;
        column: string;
        deadline: string;
        daysOverdue: number;
        assigned: string[];
      }> = [];

      for (const col of columns) {
        const tasks = await client.getPaginated<YGTask>("/tasks", {
          columnId: col.id,
        });

        for (const t of tasks) {
          if (
            t.deadline?.timestamp &&
            t.deadline.timestamp < now &&
            !t.completed
          ) {
            const daysOverdue = Math.floor(
              (now - t.deadline.timestamp) / (1000 * 60 * 60 * 24)
            );
            overdue.push({
              id: t.id,
              title: t.title,
              column: col.title,
              deadline: new Date(t.deadline.timestamp).toISOString(),
              daysOverdue,
              assigned: t.assigned || [],
            });
          }
        }
      }

      overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { boardId, totalOverdue: overdue.length, tasks: overdue },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "list_tasks_by_project",
    "List all tasks in a project by traversing boards → columns → tasks. Makes multiple API calls. Use includeCompleted=false to skip done tasks.",
    {
      projectId: z.string().describe("Project ID"),
      includeCompleted: z.boolean().optional().describe("Include completed tasks (default true)"),
    },
    async ({ projectId, includeCompleted = true }) => {
      const boards = await client.getPaginated<YGBoard>("/boards", { projectId });

      const result: Array<{
        board: string;
        column: string;
        id: string;
        title: string;
        completed: boolean;
        assigned: string[];
        deadline: string | null;
      }> = [];

      for (const board of boards) {
        const columns = await client.getPaginated<YGColumn>("/columns", { boardId: board.id });
        for (const col of columns) {
          const tasks = await client.getPaginated<YGTask>("/tasks", { columnId: col.id });
          for (const t of tasks) {
            if (!includeCompleted && t.completed) continue;
            result.push({
              board: board.title,
              column: col.title,
              id: t.id,
              title: t.title,
              completed: t.completed ?? false,
              assigned: t.assigned ?? [],
              deadline: t.deadline?.timestamp
                ? new Date(t.deadline.timestamp).toISOString()
                : null,
            });
          }
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ projectId, total: result.length, tasks: result }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "company_overdue_tasks",
    "Find ALL overdue tasks across the entire company (all projects → boards → columns). Makes many API calls — use sparingly.",
    {},
    async () => {
      const projects = await client.getPaginated<YGProject>("/projects");
      const now = Date.now();

      const overdue: Array<{
        project: string;
        board: string;
        column: string;
        id: string;
        title: string;
        deadline: string;
        daysOverdue: number;
        assigned: string[];
      }> = [];

      for (const project of projects) {
        const boards = await client.getPaginated<YGBoard>("/boards", { projectId: project.id });
        for (const board of boards) {
          const columns = await client.getPaginated<YGColumn>("/columns", { boardId: board.id });
          for (const col of columns) {
            const tasks = await client.getPaginated<YGTask>("/tasks", { columnId: col.id });
            for (const t of tasks) {
              if (t.deadline?.timestamp && t.deadline.timestamp < now && !t.completed) {
                overdue.push({
                  project: project.title,
                  board: board.title,
                  column: col.title,
                  id: t.id,
                  title: t.title,
                  deadline: new Date(t.deadline.timestamp).toISOString(),
                  daysOverdue: Math.floor((now - t.deadline.timestamp) / 86_400_000),
                  assigned: t.assigned ?? [],
                });
              }
            }
          }
        }
      }

      overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ totalOverdue: overdue.length, tasks: overdue }, null, 2),
          },
        ],
      };
    }
  );
}
