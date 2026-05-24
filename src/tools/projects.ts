import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
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

  server.tool(
    "create_project",
    "Create a new project. adminUserId is required so the project is visible — use list_users to find it, or set YOUGILE_USER_ID env var.",
    {
      title: z.string().describe("Project title"),
      adminUserId: z.string().optional().describe("User ID who becomes admin. Falls back to YOUGILE_USER_ID env var."),
    },
    async ({ title, adminUserId }) => {
      const uid = adminUserId || process.env.YOUGILE_USER_ID;
      if (!uid) {
        return {
          content: [{ type: "text" as const, text: "Error: adminUserId is required. Pass it or set YOUGILE_USER_ID env var. Use list_users to find your ID." }],
          isError: true,
        };
      }
      const project = await client.post<YGProject>("/projects", {
        title,
        users: { [uid]: "admin" },
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ id: project.id, title: project.title }, null, 2) }],
      };
    }
  );

  server.tool(
    "update_project",
    "Rename a project",
    {
      id: z.string().describe("Project ID"),
      title: z.string().describe("New title"),
    },
    async ({ id, title }) => {
      const project = await client.put<YGProject>(`/projects/${id}`, { title });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ id: project.id, title: project.title }, null, 2) }],
      };
    }
  );

  server.tool(
    "delete_project",
    "Delete (archive) a project",
    { id: z.string().describe("Project ID") },
    async ({ id }) => {
      await client.put(`/projects/${id}`, { deleted: true });
      return {
        content: [{ type: "text" as const, text: `Project ${id} deleted.` }],
      };
    }
  );
}
