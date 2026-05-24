import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { YouGileClient } from "./api/client.js";
import { registerAllTools } from "./tools/index.js";

export function createServer(apiKey: string): McpServer {
  const client = new YouGileClient(apiKey);
  const server = new McpServer(
    { name: "yougile-mcp-server", version: "1.0.0" },
    {
      instructions:
        "YouGile task management server. Navigate: list_projects → list_boards → list_columns → list_tasks. " +
        "Use create_task, update_task, move_task, complete_task for task management. " +
        "Use board_summary, my_tasks, overdue_tasks for analytics. " +
        "Use list_stickers + set_task_stickers for tagging.",
    }
  );
  registerAllTools(server, client);
  return server;
}
