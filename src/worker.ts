// Cloudflare Workers entry point: remote MCP server over Streamable HTTP.
// Deploy with `npm run deploy` (see wrangler.toml).
//
// Auth: token must appear in EITHER:
//   - URL pathname:  POST /<MCP_AUTH_TOKEN>/mcp   (used by claude.ai
//     connector UI, which has no custom-headers field)
//   - Authorization header:  Bearer <MCP_AUTH_TOKEN>  (for curl/local
//     debugging and any client that supports custom headers)
// Storing the token in the URL pathname is acceptable here because the URL
// is only entered once into Claude's connector config (encrypted at rest)
// and Cloudflare Workers do not log request URLs on the free tier.

import { createMcpHandler } from "agents/mcp";
import { createServer } from "./server.js";

interface Env {
  YOUGILE_API_KEY: string;
  MCP_AUTH_TOKEN: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Public health check — no auth
    if (url.pathname === "/" || url.pathname === "/health") {
      return jsonResponse({ status: "ok", server: "yougile-mcp" });
    }

    if (!env.MCP_AUTH_TOKEN) {
      return jsonResponse(
        { error: "MCP_AUTH_TOKEN secret is not configured" },
        500
      );
    }
    if (!env.YOUGILE_API_KEY) {
      return jsonResponse(
        { error: "YOUGILE_API_KEY secret is not configured" },
        500
      );
    }

    // Resolve the effective MCP path. Two URL shapes are accepted:
    //   /mcp                        → token must be in Authorization header
    //   /<token>/mcp                → token from path, no header needed
    let mcpRoute = "/mcp";
    let pathOk = false;

    if (url.pathname === "/mcp") {
      const auth = request.headers.get("Authorization") || "";
      if (auth.startsWith("Bearer ") && auth.slice(7).trim() === env.MCP_AUTH_TOKEN) {
        pathOk = true;
      }
    } else {
      const m = url.pathname.match(/^\/([^/]+)\/mcp$/);
      if (m && m[1] === env.MCP_AUTH_TOKEN) {
        pathOk = true;
        mcpRoute = `/${m[1]}/mcp`;
      }
    }

    if (!pathOk) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Build a fresh MCP server per request (stateless).
    const server = createServer(env.YOUGILE_API_KEY);
    const handler = createMcpHandler(server, { route: mcpRoute });
    return handler(request, env, ctx);
  },
};
