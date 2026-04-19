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
}
