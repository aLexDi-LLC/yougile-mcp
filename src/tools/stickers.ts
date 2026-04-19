import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { YouGileClient } from "../api/client.js";
import type {
  YGSticker,
  YGStickerState,
  YGSprintSticker,
  YGTask,
} from "../api/types.js";

// YouGile distinguishes "string stickers" (typed labels with named states)
// from "sprint stickers" (time-bounded states). On a task both are stored
// in the same `stickers` field as `{stickerId: stateId | "empty" | "-"}`.

export function registerStickerTools(
  server: McpServer,
  client: YouGileClient
): void {
  // ─── Read ───────────────────────────────────────────────────────────────

  server.tool(
    "list_stickers",
    "List all string stickers (typed tags). Each sticker includes its states with full IDs (id, name, color). Use these IDs in set_task_stickers / add_task_sticker.",
    {},
    async () => {
      const stickers = await client.getPaginated<YGSticker>("/string-stickers");
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              stickers.map((s) => ({
                id: s.id,
                name: s.name,
                icon: s.icon,
                deleted: s.deleted,
                states: (s.states || []).map((st) => ({
                  id: st.id,
                  name: st.name,
                  color: st.color,
                  deleted: st.deleted,
                })),
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
    "get_sticker",
    "Get a single string sticker by ID, including its states with IDs.",
    { id: z.string().describe("Sticker ID") },
    async ({ id }) => {
      const sticker = await client.get<YGSticker>(`/string-stickers/${id}`);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(sticker, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "list_sprint_stickers",
    "List sprint stickers (time-bounded states with begin/end timestamps in unix seconds).",
    {},
    async () => {
      const stickers = await client.getPaginated<YGSprintSticker>(
        "/sprint-stickers"
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(stickers, null, 2) },
        ],
      };
    }
  );

  // ─── Sticker CRUD ───────────────────────────────────────────────────────

  server.tool(
    "create_sticker",
    "Create a new string sticker (typed tag). Optionally provide initial states. Returns the created sticker including assigned IDs.",
    {
      name: z.string().describe("Sticker name (e.g. 'Priority')"),
      icon: z
        .string()
        .optional()
        .describe(
          "Icon enum (star, heart, check, prio, flag, etc). Optional."
        ),
      states: z
        .array(
          z.object({
            name: z.string(),
            color: z
              .string()
              .optional()
              .describe("Hex color like #FF0000"),
          })
        )
        .optional()
        .describe("Initial states. Can also be added later via add_sticker_state"),
    },
    async ({ name, icon, states }) => {
      const body: Record<string, unknown> = { name };
      if (icon) body.icon = icon;
      if (states) body.states = states;
      const sticker = await client.post<YGSticker>(
        "/string-stickers",
        body
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(sticker, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "update_sticker",
    "Update a string sticker's name or icon. To manage states, use add_sticker_state / update_sticker_state / delete_sticker_state.",
    {
      id: z.string().describe("Sticker ID"),
      name: z.string().optional(),
      icon: z.string().optional(),
    },
    async ({ id, name, icon }) => {
      const body: Record<string, unknown> = {};
      if (name !== undefined) body.name = name;
      if (icon !== undefined) body.icon = icon;
      const sticker = await client.put<YGSticker>(
        `/string-stickers/${id}`,
        body
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(sticker, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "delete_sticker",
    "Soft-delete a string sticker (sets deleted: true). Restorable in YouGile UI.",
    { id: z.string() },
    async ({ id }) => {
      await client.put(`/string-stickers/${id}`, { deleted: true });
      return {
        content: [
          { type: "text" as const, text: `Sticker ${id} deleted.` },
        ],
      };
    }
  );

  // ─── State CRUD ─────────────────────────────────────────────────────────

  server.tool(
    "add_sticker_state",
    "Add a new state (value) to an existing string sticker. E.g. add 'Critical' to a Priority sticker.",
    {
      stickerId: z.string(),
      name: z.string().describe("State name (e.g. 'High')"),
      color: z.string().optional().describe("Hex color like #FF0000"),
    },
    async ({ stickerId, name, color }) => {
      const body: Record<string, unknown> = { name };
      if (color) body.color = color;
      const state = await client.post<YGStickerState>(
        `/string-stickers/${stickerId}/states`,
        body
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(state, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "update_sticker_state",
    "Update an existing state (rename, recolor, or restore from deleted).",
    {
      stickerId: z.string(),
      stateId: z.string(),
      name: z.string().optional(),
      color: z.string().optional(),
      deleted: z
        .boolean()
        .optional()
        .describe("Pass true to soft-delete, false to restore"),
    },
    async ({ stickerId, stateId, name, color, deleted }) => {
      const body: Record<string, unknown> = {};
      if (name !== undefined) body.name = name;
      if (color !== undefined) body.color = color;
      if (deleted !== undefined) body.deleted = deleted;
      const state = await client.put<YGStickerState>(
        `/string-stickers/${stickerId}/states/${stateId}`,
        body
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(state, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "delete_sticker_state",
    "Soft-delete a single state from a sticker.",
    { stickerId: z.string(), stateId: z.string() },
    async ({ stickerId, stateId }) => {
      await client.put(
        `/string-stickers/${stickerId}/states/${stateId}`,
        { deleted: true }
      );
      return {
        content: [
          {
            type: "text" as const,
            text: `State ${stateId} on sticker ${stickerId} deleted.`,
          },
        ],
      };
    }
  );

  // ─── Apply stickers to tasks ────────────────────────────────────────────

  server.tool(
    "set_task_stickers",
    "REPLACE the entire stickers map on a task. Pass {stickerId: stateId} or {stickerId: 'empty'}. Use this only if you want to overwrite all stickers at once. For incremental changes prefer add_task_sticker / remove_task_sticker.",
    {
      taskId: z.string(),
      stickers: z
        .record(z.unknown())
        .describe(
          'Full stickers map, e.g. {"<stickerId>": "<stateId>"}. Special values: "empty" = sticker present without state, "-" = remove sticker.'
        ),
    },
    async ({ taskId, stickers }) => {
      const task = await client.put<YGTask>(`/tasks/${taskId}`, { stickers });
      return {
        content: [
          {
            type: "text" as const,
            text: `Stickers replaced on task "${task.title || taskId}". Current: ${JSON.stringify(task.stickers)}`,
          },
        ],
      };
    }
  );

  server.tool(
    "add_task_sticker",
    "Set a SINGLE sticker on a task without touching the others. Reads the current stickers, merges the new value, writes back.",
    {
      taskId: z.string(),
      stickerId: z.string().describe("Sticker (tag) ID"),
      stateId: z
        .string()
        .describe(
          "State ID for the sticker, or 'empty' to attach the sticker with no state, or a literal value for text/number-style stickers"
        ),
    },
    async ({ taskId, stickerId, stateId }) => {
      const current = await client.get<YGTask>(`/tasks/${taskId}`);
      const merged = { ...(current.stickers || {}), [stickerId]: stateId };
      const updated = await client.put<YGTask>(`/tasks/${taskId}`, {
        stickers: merged,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Sticker set on task "${updated.title || taskId}". Stickers: ${JSON.stringify(updated.stickers)}`,
          },
        ],
      };
    }
  );

  server.tool(
    "remove_task_sticker",
    "Remove a single sticker from a task. Sends the special value '-' which YouGile interprets as 'detach'. Other stickers are preserved.",
    {
      taskId: z.string(),
      stickerId: z.string(),
    },
    async ({ taskId, stickerId }) => {
      const current = await client.get<YGTask>(`/tasks/${taskId}`);
      const merged = { ...(current.stickers || {}), [stickerId]: "-" };
      const updated = await client.put<YGTask>(`/tasks/${taskId}`, {
        stickers: merged,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Sticker ${stickerId} removed from task "${updated.title || taskId}".`,
          },
        ],
      };
    }
  );
}
