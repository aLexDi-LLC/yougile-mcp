import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { YouGileClient } from "../api/client.js";
import type { YGChatMessage } from "../api/types.js";

// In YouGile API v2, every task has an associated chat whose ID is identical
// to the task ID. Messages live under /chats/{chatId}/messages — note the
// trailing /messages segment. Without it the server responds 404.

export function registerChatTools(
  server: McpServer,
  client: YouGileClient
): void {
  server.tool(
    "add_task_comment",
    "Post a comment in a task's chat. Use this to leave progress updates, PR links, or failure notes. The chat ID equals the task ID.",
    {
      taskId: z.string().describe("Task ID (used as chat ID)"),
      text: z.string().describe("Message text (plain text)"),
      label: z
        .string()
        .optional()
        .describe("Optional quick-reference label/tag for the message"),
    },
    async ({ taskId, text, label }) => {
      const body: Record<string, unknown> = { text };
      if (label) body.label = label;
      const res = await client.post<{ id?: string }>(
        `/chats/${taskId}/messages`,
        body
      );
      return {
        content: [
          {
            type: "text" as const,
            text: `Comment posted to task ${taskId}.${res?.id ? ` Message id: ${res.id}` : ""}`,
          },
        ],
      };
    }
  );

  server.tool(
    "get_task_comments",
    "Fetch chat messages on a task. Useful to see conversation history or to check whether a previous agent run already left notes.",
    {
      taskId: z.string().describe("Task ID (used as chat ID)"),
      fromUserId: z
        .string()
        .optional()
        .describe("Filter messages by author user ID"),
      text: z
        .string()
        .optional()
        .describe("Substring filter on message text"),
      label: z.string().optional().describe("Filter by label"),
      since: z
        .number()
        .optional()
        .describe("Return only messages after this timestamp (ms or s, see API)"),
      includeDeleted: z.boolean().optional(),
      includeSystem: z
        .boolean()
        .optional()
        .describe("Include system messages (status changes etc.)"),
    },
    async ({ taskId, ...filters }) => {
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined) params[k] = String(v);
      }
      const messages = await client.getPaginated<YGChatMessage>(
        `/chats/${taskId}/messages`,
        params
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              messages.map((m) => ({
                id: m.id,
                text: m.text,
                fromUserId: m.fromUserId,
                timestamp: m.timestamp,
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
