import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { YouGileClient } from "../api/client.js";
import type { YGBoard } from "../api/types.js";

export function registerBoardTools(
  server: McpServer,
  client: YouGileClient
): void {
  server.tool(
    "list_boards",
    "List boards in a project",
    { projectId: z.string().describe("Project ID") },
    async ({ projectId }) => {
      const boards = await client.getPaginated<YGBoard>("/boards", {
        projectId,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              boards.map((b) => ({ id: b.id, title: b.title })),
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "create_board",
    "Create a new board inside a project",
    {
      title: z.string().describe("Board title"),
      projectId: z.string().describe("Project ID"),
    },
    async ({ title, projectId }) => {
      const board = await client.post<YGBoard>("/boards", { title, projectId });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ id: board.id, title: board.title, projectId: board.projectId }, null, 2) }],
      };
    }
  );

  server.tool(
    "update_board",
    "Rename a board",
    {
      id: z.string().describe("Board ID"),
      title: z.string().describe("New title"),
    },
    async ({ id, title }) => {
      const board = await client.put<YGBoard>(`/boards/${id}`, { title });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ id: board.id, title: board.title }, null, 2) }],
      };
    }
  );

  server.tool(
    "delete_board",
    "Delete (archive) a board",
    { id: z.string().describe("Board ID") },
    async ({ id }) => {
      await client.put(`/boards/${id}`, { deleted: true });
      return {
        content: [{ type: "text" as const, text: `Board ${id} deleted.` }],
      };
    }
  );
}
