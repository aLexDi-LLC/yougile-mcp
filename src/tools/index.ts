import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { YouGileClient } from "../api/client.js";
import { registerProjectTools } from "./projects.js";
import { registerBoardTools } from "./boards.js";
import { registerColumnTools } from "./columns.js";
import { registerTaskTools } from "./tasks.js";
import { registerStickerTools } from "./stickers.js";
import { registerUserTools } from "./users.js";
import { registerAnalyticsTools } from "./analytics.js";
import { registerChatTools } from "./chats.js";
import { registerFileTools } from "./files.js";

export function registerAllTools(
  server: McpServer,
  client: YouGileClient
): void {
  registerProjectTools(server, client);
  registerBoardTools(server, client);
  registerColumnTools(server, client);
  registerTaskTools(server, client);
  registerStickerTools(server, client);
  registerUserTools(server, client);
  registerChatTools(server, client);
  registerFileTools(server, client);
  registerAnalyticsTools(server, client);
}
