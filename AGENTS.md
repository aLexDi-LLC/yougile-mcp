# AGENTS.md — Guide for AI agents using the YouGile MCP server

**English** | [Русский](./AGENTS.ru.md)

Read this before using the YouGile MCP. It explains the data model, the 18
tools, and the recommended call chains for common workflows.

## Mental model

YouGile is a hierarchical task tracker:

```
Company
└─ Project
   └─ Board
      └─ Column         ← horizontal swimlanes (Todo, In Progress, Done…)
         └─ Task
            ├─ Stickers (typed tags with optional state, e.g. Priority=High)
            ├─ Assigned users (array of user IDs)
            ├─ Deadline (timestamp + optional time)
            └─ Chat (threaded comments)
```

To find anything by name, navigate top-down: project → board → column → task.
Most filters require an ID, not a name. Always resolve names to IDs first via
the `list_*` tools.

## Auth & limits

- Authentication is handled by the server; you don't see the YouGile API key.
- Rate limit: 45 requests/min per company. The server enforces this with a
  sliding window — if you call too fast, requests will queue (not fail).
- Pagination: list tools auto-paginate. Don't worry about offsets.
- For `list_tasks` specifically, the underlying API does NOT auto-paginate
  (it returns a single page of up to 50 by default). Pass `limit: 1000` if
  you need more, or filter narrowly via `columnId` / `assignedTo`.

## Tool reference

### Navigation (always start here)

| Tool | Required input | Returns |
|------|----------------|---------|
| `list_projects` | — | `[{id, title}]` |
| `list_boards` | `projectId` | `[{id, title}]` |
| `list_columns` | `boardId` | `[{id, title, color}]` |
| `list_users` | — | `[{id, email, name}]` |

### Task CRUD

| Tool | Required input | Notes |
|------|----------------|-------|
| `list_tasks` | — (filters: `columnId`, `assignedTo`, `title`, `limit`, `offset`) | Returns one page only |
| `get_task` | `id` | Accepts UUID or task code (e.g. "PRJ-123") |
| `create_task` | `title`, `columnId` | Optional: `description`, `assigned`, `deadline`, `stickers` |
| `update_task` | `id` + any of: `title`, `description`, `columnId`, `assigned`, `completed`, `archived`, `deadline`, `stickers` | Pass only fields you want to change |
| `delete_task` | `id` | Soft delete (sets `deleted: true`, can be restored in YouGile UI) |
| `move_task` | `id`, `columnId` | Convenience for column-only update |
| `complete_task` | `id` | Convenience for `completed: true` |

#### Deadline format

```json
{
  "deadline": {
    "timestamp": 1735689600000,
    "startDate": 1735603200000,
    "withTime": true
  }
}
```

`timestamp` is the due date in milliseconds. `withTime: true` means time-of-day
matters; `false` means it's a whole-day deadline. `startDate` is optional.

### Stickers (tags)

YouGile stickers are typed labels. Each sticker has a name (e.g. "Priority")
and a list of states (e.g. ["High", "Medium", "Low"]). On a task, stickers are
stored as `{stickerId: stateId}` — the value is the state ID, not the state
name. Special task values: `"empty"` (sticker attached without a state),
`"-"` (detach the sticker).

#### Sticker reads

| Tool | Required input | Notes |
|------|----------------|-------|
| `list_stickers` | — | Returns string stickers including states with full `{id, name, color}` |
| `get_sticker` | `id` | Single sticker with all states |
| `list_sprint_stickers` | — | Sprint stickers (states have `begin`/`end` unix seconds) |

#### Sticker CRUD

| Tool | Required input | Notes |
|------|----------------|-------|
| `create_sticker` | `name` | Optional `icon`, `states: [{name, color?}]` for initial values |
| `update_sticker` | `id` + any of `name`, `icon` | Only sticker-level fields. To change states use the state tools below |
| `delete_sticker` | `id` | Soft-delete (`deleted: true`) |

#### State CRUD (values inside a sticker)

| Tool | Required input | Notes |
|------|----------------|-------|
| `add_sticker_state` | `stickerId`, `name` | Optional `color` |
| `update_sticker_state` | `stickerId`, `stateId` + any of `name`, `color`, `deleted` | |
| `delete_sticker_state` | `stickerId`, `stateId` | Soft-delete a single state |

#### Applying stickers to tasks

| Tool | Required input | Notes |
|------|----------------|-------|
| `set_task_stickers` | `taskId`, `stickers` (full map) | **REPLACES** all stickers on the task. Use only when you intentionally want to overwrite everything |
| `add_task_sticker` | `taskId`, `stickerId`, `stateId` | Sets one sticker, preserves the rest. Internally reads → merges → writes |
| `remove_task_sticker` | `taskId`, `stickerId` | Sends `"-"` for that sticker, other stickers untouched |

For routine task tagging, prefer `add_task_sticker` / `remove_task_sticker`.
`set_task_stickers` is the low-level escape hatch.

### Comments (chat)

| Tool | Required input | Notes |
|------|----------------|-------|
| `add_task_comment` | `taskId`, `text` | Optional `label` for categorization. Text supports plain text or HTML |
| `get_task_comments` | `taskId` | Returns full chat history paginated |

### Analytics (multi-call, can be slow on large boards)

| Tool | Required input | What it does |
|------|----------------|--------------|
| `board_summary` | `boardId` | Fetches all columns + all tasks per column. Returns `{totalTasks, completedCount, completedRatio, overdueCount, unassignedCount, columns: [{id, title, taskCount}]}`. Cost: 1 + N calls (N = number of columns) |
| `my_tasks` | `userId` (optional, falls back to `YOUGILE_USER_ID` env) | Returns tasks for a user grouped into `overdue` / `inProgress` / `completed` / `unscheduled`. Cost: 1-N calls |
| `overdue_tasks` | `boardId` | Same fan-out as `board_summary`, returns only overdue tasks sorted by `daysOverdue` |

## Recommended workflows

### "Create a task in board X, column Y, tagged High priority"

1. `list_projects` → find project ID
2. `list_boards` (with `projectId`) → find board ID
3. `list_columns` (with `boardId`) → find target column ID
4. `list_stickers` → find Priority sticker ID **and** its High state ID
   (both are returned in one call)
5. `create_task` with `title`, `columnId`, `stickers: {priorityId: highStateId}`

Cache the project/board/column IDs in your context — they don't change.

### "Show me a board overview"

Single call: `board_summary` with `boardId`.

### "What's on my plate?"

Single call: `my_tasks` with `userId`.

### "Move task to Done and post a completion comment"

```
move_task(id=T, columnId=DONE_COLUMN_ID)   # or: complete_task(id=T) if 'completed' state is what you need
add_task_comment(taskId=T, text="Done. PR: https://github.com/...")
```

### Autonomous dev-agent loop (the use case this server was built for)

1. `list_tasks(columnId=AGENT_COLUMN_ID)` → fetch queue
2. Filter to tasks with sticker state `agent-status: queued`
3. For each task (limit 1-3 per run):
   a. `set_task_stickers(taskId=T, stickers={agentStatusId: inProgressStateId})`
   b. `add_task_comment(taskId=T, text="Agent started. Branch: agent/task-{id}")`
   c. Read `CLAUDE.md` from the repo for rules.
   d. Implement, test, push, `gh pr create`.
   e. `add_task_comment(taskId=T, text="PR ready: <url>")`
   f. `set_task_stickers(taskId=T, stickers={agentStatusId: prReadyStateId})`
   g. On failure: `set_task_stickers` to `failed` state and `add_task_comment`
      with the error.

## Common pitfalls

- **Listing tasks across a whole board**: there is no `boardId` filter on
  `list_tasks`. You must iterate columns. Use `board_summary` if you only
  need counts.
- **Listing tasks across a whole project**: same — no `projectId` filter.
  Must walk boards → columns → tasks.
- **Sticker state IDs**: `list_stickers` and `get_sticker` now include the full
  state objects with `id`, `name`, `color`. Use the `id` when writing to a
  task's `stickers` field.
- **Soft delete**: `delete_task` sets `deleted: true` — the task is hidden
  but can be restored in YouGile UI's "Deleted" view.
- **Task code vs UUID**: `get_task` accepts both, but `update_task`,
  `move_task`, etc. expect the UUID. If you only have a code, call `get_task`
  first to obtain the UUID.

## Error handling

All tools return errors as MCP tool errors with structured messages including
the failed HTTP method, path, status code, and YouGile's response body. If you
get a 401, the YouGile API key is wrong/revoked. If you get a 429, the rate
limiter wasn't enough — wait a minute and retry. If you get a 404 on a task
ID you just created, the soft-delete may have hit it.
