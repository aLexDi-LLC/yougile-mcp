import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { YouGileClient } from "../api/client.js";
import type { YGColumn } from "../api/types.js";

export function registerColumnTools(
  server: McpServer,
  client: YouGileClient
): void {
  server.tool(
    "list_columns",
    "List columns on a board",
    { boardId: z.string().describe("Board ID") },
    async ({ boardId }) => {
      const columns = await client.getPaginated<YGColumn>("/columns", {
        boardId,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              columns.map((c) => ({
                id: c.id,
                title: c.title,
                color: c.color,
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
    "create_column",
    "Create a new column on a board. Note: use POST /columns with boardId in body (POST /boards/{id}/columns returns 404).",
    {
      title: z.string().describe("Column title"),
      boardId: z.string().describe("Board ID"),
      color: z.string().optional().describe("Column color (hex or named)"),
    },
    async ({ title, boardId, color }) => {
      const body: Record<string, unknown> = { title, boardId };
      if (color) body.color = color;
      const column = await client.post<YGColumn>("/columns", body);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ id: column.id, title: column.title, boardId: column.boardId, color: column.color }, null, 2) }],
      };
    }
  );

  server.tool(
    "update_column",
    "Rename or recolor a column",
    {
      id: z.string().describe("Column ID"),
      title: z.string().optional().describe("New title"),
      color: z.string().optional().describe("New color"),
    },
    async ({ id, title, color }) => {
      const body: Record<string, unknown> = {};
      if (title !== undefined) body.title = title;
      if (color !== undefined) body.color = color;
      const column = await client.put<YGColumn>(`/columns/${id}`, body);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ id: column.id, title: column.title, color: column.color }, null, 2) }],
      };
    }
  );

  server.tool(
    "delete_column",
    "Delete (archive) a column",
    { id: z.string().describe("Column ID") },
    async ({ id }) => {
      await client.put(`/columns/${id}`, { deleted: true });
      return {
        content: [{ type: "text" as const, text: `Column ${id} deleted.` }],
      };
    }
  );
}
