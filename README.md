# YouGile MCP Server

**English** | [Русский](./README.ru.md)

Extended Model Context Protocol (MCP) server for [YouGile](https://yougile.com) — a Russian project management system. Lets Claude and any MCP-compatible AI agent read and modify your YouGile workspace: create tasks, manage boards, set tags, post comments, and pull analytics — all from natural language.

> **Based on** [ra53n/yougile-mcp](https://github.com/ra53n/yougile-mcp) with significant extensions: 10 new tools, bug fixes, and Linux support.

---

## What's new vs the original

| Category | Added |
|---|---|
| Projects | `create_project`, `update_project`, `delete_project` |
| Boards | `create_board`, `update_board`, `delete_board` |
| Columns | `create_column`, `update_column`, `delete_column` |
| Analytics | `list_tasks_by_project`, `company_overdue_tasks` |
| Files | `upload_file`, `attach_task_file` |
| Bug fixes | `my_tasks` fixed (was 404), `list_users` names fixed (`realName` field) |

**Total: 41 tools** (original had 28).

---

## Features

### Navigation
| Tool | Description |
|---|---|
| `list_projects` | List all projects in the company |
| `list_boards` | List boards in a project |
| `list_columns` | List columns on a board |
| `list_users` | List all users (shows realName, email, isAdmin, status) |

### Task CRUD
| Tool | Description |
|---|---|
| `list_tasks` | List tasks with filters: columnId, assignedTo, title search |
| `get_task` | Get task by ID or task code (e.g. PRJ-123) |
| `create_task` | Create task with title, column, description, assignees, deadline, stickers |
| `update_task` | Update any task fields |
| `delete_task` | Soft-delete a task |
| `move_task` | Move task to another column |
| `complete_task` | Mark task as completed |

### Projects / Boards / Columns management
| Tool | Description |
|---|---|
| `create_project` | Create project (requires adminUserId — see API notes) |
| `update_project` | Rename project |
| `delete_project` | Archive project |
| `create_board` | Create board inside a project |
| `update_board` | Rename board |
| `delete_board` | Archive board |
| `create_column` | Create column on a board |
| `update_column` | Rename or recolor column |
| `delete_column` | Archive column |

### Tags (Stickers)
| Tool | Description |
|---|---|
| `list_stickers` | List all sticker definitions on a board |
| `get_sticker` | Get sticker details and states |
| `list_sprint_stickers` | List sprint stickers (time-bounded) |
| `create_sticker` | Create new sticker type |
| `update_sticker` | Rename sticker |
| `delete_sticker` | Delete sticker type |
| `add_sticker_state` | Add state to a sticker |
| `update_sticker_state` | Rename sticker state |
| `delete_sticker_state` | Delete sticker state |
| `set_task_stickers` | Set all stickers on a task at once |
| `add_task_sticker` | Add one sticker to a task |
| `remove_task_sticker` | Remove sticker from a task |

### Comments
| Tool | Description |
|---|---|
| `add_task_comment` | Post a comment in a task's chat |
| `get_task_comments` | Fetch task comment history |

### Files
| Tool | Description |
|---|---|
| `upload_file` | Upload a local file to YouGile's storage, get back a URL |
| `attach_task_file` | Upload a local file and post it as a link in a task's chat (YouGile has no native attachment object — this is the practical equivalent) |

### Analytics
| Tool | Description |
|---|---|
| `board_summary` | Task counts, completion ratio, overdue, unassigned per column |
| `my_tasks` | Tasks assigned to a user grouped by status (overdue / in progress / done) |
| `overdue_tasks` | Overdue tasks on a specific board |
| `list_tasks_by_project` | All tasks in a project (traverses boards → columns → tasks) |
| `company_overdue_tasks` | All overdue tasks across the entire company |

---

## Requirements

- **Node.js** ≥ 18 (tested on v20)
- **npm** ≥ 9
- **YouGile API key** (see below)

---

## Installation

### Linux / macOS

```bash
# 1. Install Node.js via nvm (no sudo needed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc        # or: source ~/.zshrc
nvm install 20

# 2. Clone and build
git clone https://github.com/aLexDi-LLC/yougile-mcp
cd yougile-mcp
npm install
npm run build

# 3. Configure
cp .env.example .env
nano .env               # paste YOUGILE_API_KEY
```

### Windows

```powershell
# Install Node.js (skip if already installed)
winget install OpenJS.NodeJS.LTS

# Clone and build
git clone https://github.com/aLexDi-LLC/yougile-mcp
cd yougile-mcp
npm install
npm run build

# Configure
copy .env.example .env
notepad .env            # paste YOUGILE_API_KEY
```

---

## Getting a YouGile API key

**Option A — from the app (fastest):**
1. Open YouGile in the browser
2. Press `Ctrl + ~`
3. Copy the API key shown

**Option B — via API:**
```bash
# Step 1: get your companyId
curl -X POST https://ru.yougile.com/api-v2/auth/companies \
  -H "Content-Type: application/json" \
  -d '{"login":"your@email.com","password":"yourpassword"}'

# Step 2: get API key (use companyId from step 1)
curl -X POST https://ru.yougile.com/api-v2/auth/keys/get \
  -H "Content-Type: application/json" \
  -d '{"login":"your@email.com","password":"yourpassword","companyId":"COMPANY_ID"}'
```

---

## Claude Code setup (local / stdio)

Add to your project `.mcp.json` or `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "yougile": {
      "command": "node",
      "args": ["~/yougile-mcp/dist/index.js"],
      "env": {
        "YOUGILE_API_KEY": "your-api-key",
        "YOUGILE_USER_ID": "your-user-id-optional"
      }
    }
  }
}
```

> **Linux with nvm:** use the absolute node path (find it with `which node` after `nvm use 20`):
> `"/home/YOUR_USER/.nvm/versions/node/v20.20.2/bin/node"`
>
> **Full path example (Linux):**
> ```json
> {
>   "mcpServers": {
>     "yougile": {
>       "command": "/home/YOUR_USER/.nvm/versions/node/v20.20.2/bin/node",
>       "args": ["/home/YOUR_USER/yougile-mcp/dist/index.js"],
>       "env": { "YOUGILE_API_KEY": "your-api-key" }
>     }
>   }
> }
> ```

**Multiple YouGile organizations** — add one entry per org:
```json
{
  "mcpServers": {
    "yougile-org1": { "command": "node", "args": ["..."], "env": { "YOUGILE_API_KEY": "key1" } },
    "yougile-org2": { "command": "node", "args": ["..."], "env": { "YOUGILE_API_KEY": "key2" } }
  }
}
```

Verify: run `/mcp` in Claude Code — should show `yougile: connected`.

---

## Claude Desktop setup

Edit your config file:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "yougile": {
      "command": "node",
      "args": ["C:/Users/YOUR_USER/yougile-mcp/dist/index.js"],
      "env": {
        "YOUGILE_API_KEY": "your-api-key"
      }
    }
  }
}
```

> **Windows path example:** `C:/Users/John/yougile-mcp/dist/index.js`  
> **macOS path example:** `/Users/john/yougile-mcp/dist/index.js`

---

## Remote deployment (Cloudflare Workers)

```bash
npm install
npx wrangler login
npx wrangler secret put YOUGILE_API_KEY      # paste your YouGile key
npx wrangler secret put MCP_AUTH_TOKEN       # openssl rand -hex 32
npm run deploy
```

Health check: `curl https://yougile-mcp.<subdomain>.workers.dev/health`

Connect from **claude.ai → Settings → Connectors → Add custom connector:**
```
https://yougile-mcp.<subdomain>.workers.dev/<MCP_AUTH_TOKEN>/mcp
```

---

## API notes & known quirks

| Issue | Details |
|---|---|
| `create_project` requires `adminUserId` | Without it the project is created but invisible — YouGile API quirk |
| `create_column` — use `POST /columns` | `POST /boards/{id}/columns` returns 404; pass `boardId` in request body |
| `my_tasks` — uses `assignedTo` filter | `/users/{id}/tasks` does not exist in API v2 |
| User name field | API returns `realName`, not `firstName`/`lastName` |
| Rate limit | 45 req/min per company — built-in sliding window handles this |
| `list_tasks` without `columnId` | Returns limited/empty results — filter by `columnId` or `assignedTo` |
| No attachment object | `POST /upload-file` only returns a URL — attaching means uploading, then embedding that URL yourself as a link/`<img>` in a description or chat message |
| `upload_file` / `attach_task_file` are stdio-only | They read a local file by path — not usable from the Cloudflare Workers (remote) deployment, which has no filesystem |
| Uploaded files are public | The returned URL needs no authentication to fetch — never upload secrets/credentials |

---

## Project structure

```
src/
  index.ts              stdio entry point (local mode)
  worker.ts             Cloudflare Workers entry (remote mode)
  server.ts             MCP server factory (shared)
  api/
    client.ts           YouGile HTTP client + rate limiter
    types.ts            TypeScript interfaces
  tools/
    index.ts            registers all 41 tools
    projects.ts         list + create + update + delete
    boards.ts           list + create + update + delete
    columns.ts          list + create + update + delete
    tasks.ts            CRUD + move + complete
    stickers.ts         full sticker/state management
    chats.ts            comments
    files.ts            upload_file, attach_task_file
    analytics.ts        summaries, overdue, project traversal
    users.ts            list users
  utils/
    rate-limiter.ts     sliding window 45 req/min
```

---

## References

- [ra53n/yougile-mcp](https://github.com/ra53n/yougile-mcp) — original server this project extends
- [YouGile API v2](https://ru.yougile.com/api-v2/) — official REST API reference
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk) — MCP TypeScript SDK
- [MCP specification](https://modelcontextprotocol.io) — protocol docs
- [Zod](https://github.com/colinhacks/zod) — runtime schema validation
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) — remote deployment

---

## AI agent guide

See [AGENTS.md](./AGENTS.md) for recommended workflows and call chains.

---

## License

MIT
