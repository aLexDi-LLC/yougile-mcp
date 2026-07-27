import { basename } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { YouGileClient } from "../api/client.js";

// YouGile's API has no "attachment" object on tasks or chat messages — the
// only file primitive is POST /upload-file, which stores the file and
// returns a URL. To actually attach something to a task you upload it and
// then embed that URL yourself as a link (or <img>) in the task description
// or a chat message. attach_task_file wraps that two-step dance into one
// call so agents don't have to remember the pattern.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function registerFileTools(
  server: McpServer,
  client: YouGileClient
): void {
  server.tool(
    "upload_file",
    "Upload a local file to YouGile's file storage and get back its URL. " +
      "YouGile has no separate 'attachment' object — use the returned fullUrl " +
      "as a link (or <img src>) in a task description or chat message. " +
      "For the common case of attaching a file to a task, use attach_task_file instead. " +
      "WARNING: the returned URL is publicly reachable with no authentication — never upload secrets/credentials.",
    {
      filePath: z.string().describe("Absolute path to the local file to upload"),
    },
    async ({ filePath }) => {
      const uploaded = await client.uploadFile(filePath);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(uploaded, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "attach_task_file",
    "Upload a local file and post it as a link in the task's chat — the " +
      "practical equivalent of 'attaching' a file, since YouGile has no " +
      "native attachment object. The chat ID equals the task ID. " +
      "WARNING: the uploaded file becomes publicly reachable with no authentication — never attach secrets/credentials.",
    {
      taskId: z.string().describe("Task ID (used as chat ID)"),
      filePath: z.string().describe("Absolute path to the local file to upload"),
      message: z
        .string()
        .optional()
        .describe("Optional text to post above the file link"),
    },
    async ({ taskId, filePath, message }) => {
      const uploaded = await client.uploadFile(filePath);
      const fileName = basename(filePath);

      const textParts = [message, `${fileName}: ${uploaded.fullUrl}`].filter(
        (part): part is string => Boolean(part)
      );
      const htmlParts = [
        message ? `<p>${escapeHtml(message)}</p>` : "",
        // fullUrl comes back from YouGile and echoes the uploaded filename
        // verbatim, which the caller controls — escape it like any other
        // attribute value rather than trusting it to already be safe.
        `<p><a href="${escapeHtml(uploaded.fullUrl)}" target="_blank" rel="noopener">${escapeHtml(
          fileName
        )}</a></p>`,
      ].filter(Boolean);

      const res = await client.post<{ id?: string }>(
        `/chats/${taskId}/messages`,
        { text: textParts.join("\n"), textHtml: htmlParts.join("") }
      );

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Uploaded "${fileName}" and attached it to task ${taskId} as a link (${uploaded.fullUrl}).` +
              (res?.id ? ` Message id: ${res.id}` : ""),
          },
        ],
      };
    }
  );
}
