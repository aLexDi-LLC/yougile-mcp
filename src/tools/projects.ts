import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { YouGileClient } from "../api/client.js";
import type { YGProject } from "../api/types.js";

export function registerProjectTools(
  server: McpServer,
  client: YouGileClient
): void {
  server.tool("list_projects", "List all projects in the company", {}, async () => {
    const projects = await client.getPaginated<YGProject>("/projects");
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            projects.map((p) => ({ id: p.id, title: p.title })),
            null,
            2
          ),
        },
      ],
    };
  });
}
