import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { YouGileClient } from "../api/client.js";
import type { YGSticker, YGTask } from "../api/types.js";

export function registerStickerTools(
  server: McpServer,
  client: YouGileClient
): void {
  server.tool(
    "list_stickers",
    "List all available stickers (tags/labels). Stickers can have states (e.g. Priority: High/Medium/Low). Use sticker IDs with set_task_stickers.",
    {},
    async () => {
      const stickers = await client.getPaginated<YGSticker>("/stickers");
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              stickers.map((s) => ({
                id: s.id,
                name: s.name,
                states: s.states?.map((st) => st.name),
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
    "set_task_stickers",
    "Set stickers on a task. Pass a stickers object where keys are sticker IDs and values are: state name (string) for stickers with states, or true for simple stickers. Call list_stickers first to get available sticker IDs and their states.",
    {
      taskId: z.string().describe("Task ID"),
      stickers: z
        .record(z.unknown())
        .describe(
          'Stickers to set. Example: {"stickerId1": "High", "stickerId2": true}'
        ),
    },
    async ({ taskId, stickers }) => {
      const task = await client.put<YGTask>(`/tasks/${taskId}`, { stickers });
      return {
        content: [
          {
            type: "text" as const,
            text: `Stickers updated on task "${task.title || taskId}". Current stickers: ${JSON.stringify(task.stickers)}`,
          },
        ],
      };
    }
  );
}
