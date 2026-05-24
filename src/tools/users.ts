import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { YouGileClient } from "../api/client.js";
import type { YGUser } from "../api/types.js";

export function registerUserTools(
  server: McpServer,
  client: YouGileClient
): void {
  server.tool("list_users", "List all users in the company", {}, async () => {
    const users = await client.getPaginated<YGUser>("/users");
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            users.map((u) => ({
              id: u.id,
              email: u.email,
              name: u.realName || u.email,
              isAdmin: u.isAdmin ?? false,
              status: u.status,
            })),
            null,
            2
          ),
        },
      ],
    };
  });
}
