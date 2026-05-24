# AGENTS.md — YouGile MCP: Guide for AI Agents

**English** | [Русский](./AGENTS.ru.md)

This file is intended **for AI agents** — it is loaded into context automatically by frameworks like Claude Code. Read it before making any YouGile tool calls.

> This MCP server works with **any AI that supports the Model Context Protocol**: Claude, GPT-4o, Gemini, Qwen, GigaChat, Mistral, and local models via MCP bridges.

---

## 1. Mental model

YouGile is a hierarchical task tracker:

```
Company
└─ Project
   └─ Board
      └─ Column        ← swimlanes: Backlog / In Progress / Done / etc.
         └─ Task
            ├─ Stickers   — typed tags with named states (e.g. Priority=High)
            ├─ Assigned   — array of user IDs
            ├─ Deadline   — timestamp in ms + optional time flag
            └─ Chat       — threaded comments (chatId == taskId)
```

**Navigation rule:** everything requires IDs. Always resolve names → IDs top-down:
`list_projects` → `list_boards` → `list_columns` → then act.

---

## 2. Auth & rate limits

- API key is injected server-side via `YOUGILE_API_KEY` env. You never see it.
- Rate limit: **45 req/min** per company. The server queues excess requests automatically — you will never get a 429.
- All `list_*` tools auto-paginate. Never worry about offsets.
- Exception: `list_tasks` returns one page (default 50). Use `columnId` / `assignedTo` filters or pass `limit: 1000`.

---

## 3. Tool reference — all 39 tools

### Navigation

| Tool | Input | Returns |
|---|---|---|
| `list_projects` | — | `[{id, title}]` |
| `list_boards` | `projectId` | `[{id, title}]` |
| `list_columns` | `boardId` | `[{id, title, color}]` |
| `list_users` | — | `[{id, email, name, isAdmin, status}]` |

### Task CRUD

| Tool | Required | Optional | Notes |
|---|---|---|---|
| `list_tasks` | — | `columnId`, `assignedTo`, `title`, `limit`, `offset` | Filter by column OR user |
| `get_task` | `id` | — | Accepts UUID or task code (e.g. `PRJ-123`) |
| `create_task` | `title`, `columnId` | `description`, `assigned[]`, `deadline`, `stickers` | Returns `{id}` |
| `update_task` | `id` | any field | Pass only changed fields |
| `delete_task` | `id` | — | Soft-delete — restorable in UI |
| `move_task` | `id`, `columnId` | — | Shortcut for column change |
| `complete_task` | `id` | — | Sets `completed: true` |

**Deadline format:**
```json
{ "timestamp": 1735689600000, "startDate": 1735603200000, "withTime": true }
```
`timestamp` — due date in **milliseconds**. `withTime: false` = whole-day deadline.

### Structure management (create / rename / delete)

| Tool | Required | Notes |
|---|---|---|
| `create_project` | `title` | Also pass `adminUserId` (or set `YOUGILE_USER_ID` env) — otherwise project is created but **invisible** |
| `update_project` | `id`, `title` | Rename |
| `delete_project` | `id` | Archive |
| `create_board` | `title`, `projectId` | — |
| `update_board` | `id`, `title` | Rename |
| `delete_board` | `id` | Archive |
| `create_column` | `title`, `boardId` | Uses `POST /columns` with `boardId` in body — NOT `POST /boards/{id}/columns` (that returns 404) |
| `update_column` | `id` | Optional: `title`, `color` |
| `delete_column` | `id` | Archive |

### Stickers (typed tags)

Stickers = label types (e.g. "Priority") with states (e.g. "High", "Medium", "Low").  
On a task: `stickers: { stickerId: stateId }`. Special values: `"empty"` = attached without state, `"-"` = detach.

| Tool | Required | Notes |
|---|---|---|
| `list_stickers` | — | Returns all sticker types + their states |
| `get_sticker` | `id` | Single sticker with all states |
| `list_sprint_stickers` | — | Time-bounded stickers (states have `begin`/`end`) |
| `create_sticker` | `name` | Optional: `icon`, `states: [{name, color}]` |
| `update_sticker` | `id` | Optional: `name`, `icon` |
| `delete_sticker` | `id` | Soft-delete |
| `add_sticker_state` | `stickerId`, `name` | Optional: `color` |
| `update_sticker_state` | `stickerId`, `stateId` | Optional: `name`, `color`, `deleted` |
| `delete_sticker_state` | `stickerId`, `stateId` | Soft-delete |
| `set_task_stickers` | `taskId`, `stickers` | **REPLACES ALL** stickers — use carefully |
| `add_task_sticker` | `taskId`, `stickerId`, `stateId` | Adds one, preserves rest |
| `remove_task_sticker` | `taskId`, `stickerId` | Removes one, preserves rest |

Prefer `add_task_sticker` / `remove_task_sticker` for routine tagging. `set_task_stickers` is the low-level override.

### Comments

| Tool | Required | Notes |
|---|---|---|
| `add_task_comment` | `taskId`, `text` | Optional `label`. Supports plain text or HTML |
| `get_task_comments` | `taskId` | Full chat history, auto-paginated |

### Analytics

| Tool | Required | What it does | Cost |
|---|---|---|---|
| `board_summary` | `boardId` | Per-column task counts, completion %, overdue count, unassigned count | 1 + N calls |
| `my_tasks` | `userId` (opt) | Tasks for a user grouped: overdue / inProgress / completed / unscheduled | 1 call |
| `overdue_tasks` | `boardId` | Overdue tasks on a board sorted by `daysOverdue` | 1 + N calls |
| `list_tasks_by_project` | `projectId` | **All tasks** in a project — traverses boards → columns → tasks. `includeCompleted: false` skips done | Many calls |
| `company_overdue_tasks` | — | **All overdue tasks company-wide** — traverses all projects | Many calls |

⚠️ `list_tasks_by_project` and `company_overdue_tasks` make many API calls. Use sparingly on large workspaces.

---

## 4. Recommended workflows

### Find a task by name
```
list_projects → find project
list_boards(projectId) → find board
list_columns(boardId) → get column IDs
list_tasks(columnId=X, title="search term")
```

### Create a task with priority tag
```
1. list_projects → projectId
2. list_boards(projectId) → boardId
3. list_columns(boardId) → columnId of target column
4. list_stickers → find Priority sticker id + High state id
5. create_task(title, columnId, stickers={priorityId: highStateId})
```

### Get a project overview
```
list_tasks_by_project(projectId, includeCompleted=false)
```

### Daily standup report
```
my_tasks(userId) → overdue + inProgress sections
```

### Find all overdue across the company
```
company_overdue_tasks()   ← single call, no parameters
```

### Complete a task and log it
```
complete_task(id)
add_task_comment(taskId=id, text="Done. Result: ...")
```

### Autonomous agent loop (CI/CD integration)
```
1. list_tasks(columnId=QUEUE_COLUMN)
2. Filter tasks with sticker agent-status=queued
3. For each task (max 3 per run):
   a. add_task_sticker(taskId, agentStatusId, inProgressStateId)
   b. add_task_comment(taskId, "Started. Branch: feature/task-{id}")
   c. ... do work ...
   d. add_task_comment(taskId, "Done. PR: https://...")
   e. add_task_sticker(taskId, agentStatusId, doneStateId)
   f. move_task(taskId, columnId=REVIEW_COLUMN)
   g. On failure: add_task_sticker → failedStateId + add_task_comment with error
```

### Set up a new project from scratch
```
1. list_users → get your userId
2. create_project(title="My Project", adminUserId=yourId)
3. create_board(title="Main Board", projectId=newProjectId)
4. create_column(title="Backlog", boardId=newBoardId)
5. create_column(title="In Progress", boardId=newBoardId)
6. create_column(title="Done", boardId=newBoardId)
7. create_task(title="First task", columnId=backlogColumnId)
```

---

## 5. Common pitfalls

| Pitfall | Correct approach |
|---|---|
| `list_tasks` without filter returns empty | Always use `columnId` or `assignedTo` |
| `create_project` without `adminUserId` | Project is invisible — always pass it |
| `create_column` using `/boards/{id}/columns` URL | Wrong — use `POST /columns` with `boardId` in body |
| Passing sticker state **name** instead of **ID** | Call `list_stickers` first, use `state.id` |
| `move_task` vs `complete_task` | `move_task` changes column only; `complete_task` sets the `completed` flag |
| Task code (PRJ-123) in update_task | Doesn't work — call `get_task("PRJ-123")` first to get the UUID |
| `company_overdue_tasks` on 100+ task workspace | Slow — many API calls, rate-limited to 45/min |

---

## 6. System prompt snippets for different AI frameworks

Copy the appropriate snippet into your system prompt when integrating this MCP server.

### Claude (Claude Code / Claude Desktop)
```
You have access to the YouGile MCP server (tool prefix: mcp__yougile__).
YouGile hierarchy: Company → Project → Board → Column → Task.
Always navigate top-down: list_projects → list_boards → list_columns before creating or updating tasks.
Use list_tasks with columnId or assignedTo filters — never without filters.
For project-wide task lists use list_tasks_by_project(projectId).
For company-wide overdue report use company_overdue_tasks().
When creating a project always pass adminUserId (get it from list_users).
Cache resolved IDs in context — they don't change during a session.
```

### OpenAI GPT-4o / GPT-4-turbo (via MCP bridge)
```
You have access to YouGile task management tools via MCP.
Tool naming convention: list_projects, list_boards, list_columns, list_tasks, create_task, update_task, etc.
IMPORTANT: YouGile requires IDs for all operations. Always call list_projects first, then list_boards, then list_columns to resolve names to IDs before acting.
To get all tasks in a project use list_tasks_by_project. To find overdue tasks company-wide use company_overdue_tasks.
Never call list_tasks without a columnId or assignedTo filter.
```

### Google Gemini (via MCP bridge)
```
You are connected to a YouGile project management system through MCP tools.
The data hierarchy is: Project > Board > Column > Task.
Always start by calling list_projects to discover available projects, then drill down.
Use board_summary(boardId) for quick board analytics.
Use my_tasks(userId) to get a user's task list grouped by urgency.
Use company_overdue_tasks() (no parameters) to find all overdue tasks across all projects.
```

### Qwen / Alibaba (via MCP bridge)
```
You have YouGile task management tools available.
Start every session with list_projects to understand the workspace structure.
Required navigation sequence: list_projects → list_boards(projectId) → list_columns(boardId) → then task operations.
For task creation: create_task requires title and columnId at minimum.
For full project task listing: use list_tasks_by_project(projectId, includeCompleted=false) to skip done tasks.
```

### GigaChat / Sber (via MCP bridge)
```
Тебе доступны инструменты управления задачами YouGile через MCP.
Иерархия данных: Компания → Проект → Доска → Колонка → Задача.
Перед любым действием с задачей — получи нужные ID: list_projects → list_boards → list_columns.
Для получения всех задач проекта: list_tasks_by_project(projectId).
Для отчёта по просроченным по всей компании: company_overdue_tasks() без параметров.
Для дашборда доски: board_summary(boardId).
```

### Ollama / Local models (via mcp-bridge or LM Studio)
```
You have access to YouGile project management via MCP tools.
Key rules:
1. All tools require IDs, not names. Use list_* tools to get IDs first.
2. Navigation order: list_projects → list_boards → list_columns → list_tasks
3. list_tasks MUST have columnId or assignedTo filter, otherwise returns empty.
4. To list all tasks in a project: list_tasks_by_project(projectId)
5. To find all overdue: company_overdue_tasks() with no parameters
6. Sticker states need their ID: call list_stickers first.
```

### Microsoft AutoGen (`autogen-ext[mcp]` — native, no bridge needed)

AutoGen has **built-in MCP support**. Works with any model: GPT-4o, Claude, Gemini, local via Ollama.

```bash
pip install "autogen-ext[mcp]" "autogen-agentchat"
```

```python
import asyncio
from autogen_ext.tools.mcp import StdioServerParams, mcp_server_tools
from autogen_agentchat.agents import AssistantAgent
from autogen_ext.models.openai import OpenAIChatCompletionClient  # swap for any model

async def main():
    # Local stdio server
    server_params = StdioServerParams(
        command="node",  # full path on Linux: /home/user/.nvm/versions/node/v20.20.2/bin/node
        args=["/path/to/yougile-mcp/dist/index.js"],
        env={"YOUGILE_API_KEY": "your-api-key"}
    )

    tools = await mcp_server_tools(server_params)  # auto-discovers all 39 tools
    print(f"Loaded {len(tools)} tools: {[t.name for t in tools]}")

    agent = AssistantAgent(
        name="yougile_agent",
        model_client=OpenAIChatCompletionClient(model="gpt-4o"),
        tools=tools,
        system_message="""
        You have YouGile task management tools.
        Navigation: list_projects → list_boards(projectId) → list_columns(boardId) → list_tasks(columnId=...).
        Never call list_tasks without columnId or assignedTo filter.
        For all project tasks: list_tasks_by_project(projectId).
        For company-wide overdue: company_overdue_tasks() — no parameters.
        """
    )

    result = await agent.run(task="Show all projects and their overdue task counts")
    print(result.messages[-1].content)

asyncio.run(main())
```

For **remote mode** (Cloudflare Workers):
```python
from autogen_ext.tools.mcp import StreamableHttpServerParams, mcp_server_tools

server_params = StreamableHttpServerParams(
    url="https://yougile-mcp.your-subdomain.workers.dev/YOUR_TOKEN/mcp"
)
tools = await mcp_server_tools(server_params)
```

### LangChain / LangGraph

```bash
pip install langchain-mcp-adapters
```

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

async with MultiServerMCPClient({
    "yougile": {
        "command": "node",
        "args": ["/path/to/yougile-mcp/dist/index.js"],
        "env": {"YOUGILE_API_KEY": "your-key"},
        "transport": "stdio"
    }
}) as client:
    tools = client.get_tools()
    # use with any LangChain agent or LangGraph workflow
```

---

## 7. MCP compatibility

This server implements the **Model Context Protocol (MCP)** stdio transport. It is compatible with any client that supports MCP:

| Client | Support | Notes |
|---|---|---|
| **Claude Code** | ✅ Native | Configure in `.mcp.json` |
| **Claude Desktop** | ✅ Native | Configure in `claude_desktop_config.json` |
| **OpenAI GPT** | ⚠️ Via bridge | Use [mcp-bridge](https://github.com/bartolli/mcp-bridge) or similar |
| **Google Gemini** | ⚠️ Via bridge | Google AI Studio MCP support (experimental) |
| **Qwen** | ⚠️ Via bridge | Works with any OpenAI-compatible MCP bridge |
| **GigaChat** | ⚠️ Via bridge | Requires custom MCP adapter |
| **Mistral** | ⚠️ Via bridge | Via OpenAI-compatible bridge |
| **Ollama / LM Studio** | ⚠️ Via bridge | Use [mcp-bridge](https://github.com/bartolli/mcp-bridge) |
| **LangChain / LangGraph** | ⚠️ Via adapter | `pip install langchain-mcp-adapters` |
| **AutoGen** | ✅ Native MCP | `pip install "autogen-ext[mcp]"` — no bridge needed |

**Remote mode** (Cloudflare Workers / HTTP transport) is compatible with any HTTP-capable client without needing a bridge.

---

## 8. Error reference

| HTTP status | Meaning | Action |
|---|---|---|
| `401` | Invalid or revoked API key | Regenerate key via `Ctrl+~` in YouGile |
| `404` | Entity not found or endpoint missing | Check if ID is correct; some endpoints don't exist (e.g. `/users/{id}/tasks`) |
| `429` | Rate limit (shouldn't happen — built-in limiter) | Wait 1 minute |
| `400` | Bad request body | Check required fields; `create_project` needs `adminUserId` |
