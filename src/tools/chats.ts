import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { YouGileClient } from "../api/client.js";
import type { YGChatMessage } from "../api/types.js";

export function registerChatTools(
  server: McpServer,
  client: YouGileClient
): void {
  server.tool(
    "add_task_comment",
    "Post a comment in the task chat. Use this to leave progress updates, PR links, or failure reports on a task.",
    {
      taskId: z.string().describe("Task ID"),
      text: z.string().describe("Comment text (plain text or HTML)"),
      label: z
        .string()
        .optional()
        .describe("Optional label/category for the message"),
    },
    async ({ taskId, text, label }) => {
      const body: Record<string, unknown> = { text };
      if (label) body.label = label;
      await client.post(`/chats/${taskId}`, body);
      return {
        content: [
          {
            type: "text" as const,
            text: `Comment posted to task ${taskId}.`,
          },
        ],
      };
    }
  );

  server.tool(
    "get_task_comments",
    "Fetch chat messages/comments on a task. Useful to see conversation history or check if a previous agent run left notes.",
    { taskId: z.string().describe("Task ID") },
    async ({ taskId }) => {
      const messages = await client.getPaginated<YGChatMessage>(
        `/chats/${taskId}`
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              messages.map((m) => ({
                id: m.id,
                text: m.text,
                createdBy: m.createdBy,
                createdAt: m.createdAt,
                label: m.label,
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
