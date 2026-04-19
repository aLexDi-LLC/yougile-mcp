import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { YouGileClient } from "../api/client.js";
import type { YGTask } from "../api/types.js";

export function registerTaskTools(
  server: McpServer,
  client: YouGileClient
): void {
  server.tool(
    "list_tasks",
    "List tasks with optional filters. Use columnId to filter by board column, assignedTo for user, title for search.",
    {
      columnId: z.string().optional().describe("Filter by column ID"),
      assignedTo: z.string().optional().describe("Filter by assigned user ID"),
      title: z.string().optional().describe("Search by title substring"),
      limit: z.number().optional().describe("Max results (default 50)"),
      offset: z.number().optional().describe("Pagination offset"),
    },
    async ({ columnId, assignedTo, title, limit, offset }) => {
      const params: Record<string, string> = {};
      if (columnId) params.columnId = columnId;
      if (assignedTo) params.assignedTo = assignedTo;
      if (title) params.title = title;
      if (limit) params.limit = String(limit);
      if (offset) params.offset = String(offset);

      const res = await client.get<{ paging: unknown; content: YGTask[] }>(
        "/tasks",
        params
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              res.content.map((t) => ({
                id: t.id,
                title: t.title,
                completed: t.completed,
                assigned: t.assigned,
                deadline: t.deadline,
                stickers: t.stickers,
              })),
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "get_task",
    "Get task details by ID (UUID) or task code (e.g. 'PRJ-123')",
    { id: z.string().describe("Task ID or task code") },
    async ({ id }) => {
      const task = await client.get<YGTask>(`/tasks/${id}`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }],
      };
    }
  );

  server.tool(
    "create_task",
    "Create a new task. Requires title and columnId. Optionally set description, assigned users, deadline, and stickers.",
    {
      title: z.string().describe("Task title"),
      columnId: z.string().describe("Column ID to place the task in"),
      description: z.string().optional().describe("Task description (HTML supported)"),
      assigned: z
        .array(z.string())
        .optional()
        .describe("Array of user IDs to assign"),
      deadline: z
        .object({
          timestamp: z.number().describe("Deadline timestamp in ms"),
          startDate: z.number().optional().describe("Start date timestamp in ms"),
          withTime: z.boolean().optional().describe("Whether time component is significant"),
        })
        .optional()
        .describe("Deadline settings"),
      stickers: z
        .record(z.unknown())
        .optional()
        .describe(
          "Stickers object: keys are sticker IDs, values are state names or true. Use list_stickers to see available stickers."
        ),
    },
    async ({ title, columnId, description, assigned, deadline, stickers }) => {
      const body: Record<string, unknown> = { title, columnId };
      if (description !== undefined) body.description = description;
      if (assigned !== undefined) body.assigned = assigned;
      if (deadline !== undefined) body.deadline = deadline;
      if (stickers !== undefined) body.stickers = stickers;

      const task = await client.post<YGTask>("/tasks", body);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }],
      };
    }
  );

  server.tool(
    "update_task",
    "Update task fields. Pass only the fields you want to change.",
    {
      id: z.string().describe("Task ID"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      columnId: z.string().optional().describe("Move to column"),
      assigned: z.array(z.string()).optional().describe("New assigned user IDs"),
      completed: z.boolean().optional().describe("Set completion status"),
      archived: z.boolean().optional().describe("Set archive status"),
      deadline: z
        .object({
          timestamp: z.number(),
          startDate: z.number().optional(),
          withTime: z.boolean().optional(),
        })
        .optional()
        .describe("New deadline"),
      stickers: z.record(z.unknown()).optional().describe("Update stickers"),
    },
    async ({
      id,
      title,
      description,
      columnId,
      assigned,
      completed,
      archived,
      deadline,
      stickers,
    }) => {
      const body: Record<string, unknown> = {};
      if (title !== undefined) body.title = title;
      if (description !== undefined) body.description = description;
      if (columnId !== undefined) body.columnId = columnId;
      if (assigned !== undefined) body.assigned = assigned;
      if (completed !== undefined) body.completed = completed;
      if (archived !== undefined) body.archived = archived;
      if (deadline !== undefined) body.deadline = deadline;
      if (stickers !== undefined) body.stickers = stickers;

      const task = await client.put<YGTask>(`/tasks/${id}`, body);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }],
      };
    }
  );

  server.tool(
    "delete_task",
    "Soft-delete a task (can be restored)",
    { id: z.string().describe("Task ID") },
    async ({ id }) => {
      await client.put(`/tasks/${id}`, { deleted: true });
      return {
        content: [{ type: "text" as const, text: `Task ${id} deleted.` }],
      };
    }
  );

  server.tool(
    "move_task",
    "Move a task to a different column",
    {
      id: z.string().describe("Task ID"),
      columnId: z.string().describe("Target column ID"),
    },
    async ({ id, columnId }) => {
      const task = await client.put<YGTask>(`/tasks/${id}`, { columnId });
      return {
        content: [
          {
            type: "text" as const,
            text: `Task "${task.title || id}" moved to column ${columnId}.`,
          },
        ],
      };
    }
  );

  server.tool(
    "complete_task",
    "Mark a task as completed",
    { id: z.string().describe("Task ID") },
    async ({ id }) => {
      const task = await client.put<YGTask>(`/tasks/${id}`, {
        completed: true,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Task "${task.title || id}" marked as completed.`,
          },
        ],
      };
    }
  );
}
