# YouGile MCP Server

**English** | [Русский](./README.ru.md)

Custom Model Context Protocol (MCP) server for [YouGile](https://yougile.com) task management.
Lets Claude (and any MCP-compatible AI agent) read and modify your YouGile boards: create tasks,
move them between columns, set tags (stickers), post comments, and pull analytics.

Runs in two modes:
- **Local (stdio)** — for Claude Desktop / Claude Code on your machine
- **Remote (Cloudflare Workers)** — single hosted instance shared across all your devices,
  usable from claude.ai connectors and Claude Code routines

## Features

18 tools across 6 categories:

- **Navigation** — `list_projects`, `list_boards`, `list_columns`, `list_users`
- **Task CRUD** — `list_tasks`, `get_task`, `create_task`, `update_task`, `delete_task`,
  `move_task`, `complete_task`
- **Tags / Stickers** — `list_stickers`, `set_task_stickers`
- **Comments** — `add_task_comment`, `get_task_comments`
- **Analytics** — `board_summary`, `my_tasks`, `overdue_tasks`

Built-in rate limiting (45 req/min, well under YouGile's 50 req/min cap).

## Architecture

```
┌──────────────┐                 ┌──────────────────┐               ┌──────────────┐
│  Claude /    │  MCP protocol   │  This server     │  YouGile API  │   YouGile    │
│  agent       │ ──────────────► │  (stdio or HTTP) │ ────────────► │   cloud      │
└──────────────┘                 └──────────────────┘               └──────────────┘
```

The server is a thin, typed wrapper around the YouGile REST API v2.
Each MCP tool corresponds to one or a few YouGile API calls.
Authentication to YouGile uses a Bearer API key stored in `YOUGILE_API_KEY`.

## Quick start — Local (stdio)

```bash
npm install
npm run build
```

Add to your Claude Desktop / Code MCP config:

```json
{
  "mcpServers": {
    "yougile": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "YOUGILE_API_KEY": "your-yougile-api-key",
        "YOUGILE_USER_ID": "optional-your-user-id-for-my_tasks"
      }
    }
  }
}
```

## Quick start — Remote (Cloudflare Workers)

```bash
npm install
npx wrangler login
npx wrangler secret put YOUGILE_API_KEY     # paste YouGile API key
npx wrangler secret put MCP_AUTH_TOKEN      # paste random string (openssl rand -hex 32)
npm run deploy
```

You'll get a URL like `https://yougile-mcp.<your-subdomain>.workers.dev`.

Verify: `curl https://yougile-mcp.<...>.workers.dev/health` → `{"status":"ok"}`

### Connecting from claude.ai

`claude.ai` connector UI does not support custom HTTP headers, so the auth token
goes in the URL pathname:

1. https://claude.ai/settings/connectors → **Add custom connector**
2. URL: `https://yougile-mcp.<...>.workers.dev/<MCP_AUTH_TOKEN>/mcp`
3. OAuth fields: leave empty
4. Save → Claude lists 18 tools

### Connecting via curl / programmatic clients

Use the `Authorization: Bearer <token>` header:

```bash
curl -X POST https://yougile-mcp.<...>.workers.dev/mcp \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Getting a YouGile API key

```bash
# 1. Get companyId
curl -X POST https://ru.yougile.com/api-v2/auth/companies \
  -H "Content-Type: application/json" \
  -d '{"login":"YOUR_EMAIL","password":"YOUR_PASSWORD"}'

# 2. Get API key (paste companyId from step 1)
curl -X POST https://ru.yougile.com/api-v2/auth/keys \
  -H "Content-Type: application/json" \
  -d '{"login":"YOUR_EMAIL","password":"YOUR_PASSWORD","companyId":"..."}'
```

## Project layout

```
src/
  index.ts           stdio entry (local mode)
  worker.ts          Cloudflare Workers entry (remote mode)
  server.ts          MCP server factory shared by both entries
  api/
    client.ts        YouGile HTTP client + rate limiter
    types.ts         TypeScript interfaces for YouGile entities
  tools/
    index.ts         registers all tools on the server
    projects.ts boards.ts columns.ts users.ts
    tasks.ts         CRUD + move + complete
    stickers.ts      list + set
    chats.ts         add + get comments
    analytics.ts     board_summary, my_tasks, overdue_tasks
  utils/
    rate-limiter.ts  sliding window 45 req/min
```

## Documentation for AI agents

See [AGENTS.md](./AGENTS.md) for the full tool reference and recommended
workflows when an agent uses this MCP server.

## License

MIT
