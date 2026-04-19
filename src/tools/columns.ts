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
}
