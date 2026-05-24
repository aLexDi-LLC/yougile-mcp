# Changelog

## [1.1.0] — 2026-05-24

### Added
- `create_project` — create a new project (with `adminUserId` requirement documented)
- `update_project` — rename a project
- `delete_project` — archive a project
- `create_board` — create a board inside a project
- `update_board` — rename a board
- `delete_board` — archive a board
- `create_column` — create a column on a board (`POST /columns` with `boardId` in body)
- `update_column` — rename or recolor a column
- `delete_column` — archive a column
- `list_tasks_by_project` — traverse all boards → columns → tasks for a project in one call
- `company_overdue_tasks` — find all overdue tasks across the entire company (no parameters)
- `.env.example` — template for environment variables
- Linux installation instructions (nvm-based, no sudo required)
- Multi-organization setup documented in README

### Fixed
- `my_tasks` — was calling `/users/{id}/tasks` which returns 404 in YouGile API v2;
  now uses `GET /tasks?assignedTo={userId}` which works correctly
- `list_users` — names displayed as `"undefined undefined"` because the API returns
  `realName` instead of `firstName`/`lastName`; fixed in both `types.ts` and `users.ts`

### Changed
- Removed `agents` package from dependencies (only needed for Cloudflare Workers deploy,
  was causing `zod@3` vs `zod@4` peer dependency conflict on fresh installs)
- `YGUser` interface updated to reflect actual API response shape
- README.md and README.ru.md updated to document all 38 tools

## [1.0.0] — 2026-05-22

Initial release by [ra53n](https://github.com/ra53n/yougile-mcp).

- 28 tools across 6 categories
- Local (stdio) and remote (Cloudflare Workers) modes
- Built-in rate limiter (45 req/min sliding window)
