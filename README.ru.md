# YouGile MCP Server

[English](./README.md) | **Русский**

Кастомный MCP-сервер (Model Context Protocol) для российского сервиса управления
задачами [YouGile](https://yougile.com). Позволяет Claude и любому другому
AI-агенту, поддерживающему MCP, читать и изменять твои доски: создавать задачи,
двигать их между колонками, ставить теги (стикеры), писать комментарии и
получать аналитику.

Работает в двух режимах:
- **Локально (stdio)** — для Claude Desktop / Claude Code на твоём компьютере
- **Удалённо (Cloudflare Workers)** — один развёрнутый инстанс, доступный со
  всех твоих устройств; используется в claude.ai через коннекторы и в
  routines (автономные агенты по расписанию)

## Возможности

28 инструментов в 6 категориях:

- **Навигация** — `list_projects`, `list_boards`, `list_columns`, `list_users`
- **CRUD задач** — `list_tasks`, `get_task`, `create_task`, `update_task`,
  `delete_task`, `move_task`, `complete_task`
- **Теги (стикеры)** — `list_stickers`, `get_sticker`, `list_sprint_stickers`,
  `create_sticker`, `update_sticker`, `delete_sticker`,
  `add_sticker_state`, `update_sticker_state`, `delete_sticker_state`,
  `set_task_stickers`, `add_task_sticker`, `remove_task_sticker`
- **Комментарии** — `add_task_comment`, `get_task_comments`
- **Аналитика** — `board_summary`, `my_tasks`, `overdue_tasks`

Встроенный rate limiter: 45 запросов/мин (запас под лимит YouGile в 50/мин).

## Архитектура

```
┌──────────────┐                  ┌────────────────────┐                ┌──────────────┐
│  Claude /    │   протокол MCP   │   этот сервер      │  YouGile API   │   YouGile    │
│  агент       │ ───────────────► │  (stdio или HTTP)  │ ─────────────► │   облако     │
└──────────────┘                  └────────────────────┘                └──────────────┘
```

Сервер — это типизированная обёртка над REST API YouGile v2. Каждый MCP-инструмент
соответствует одному или нескольким вызовам API. Аутентификация в YouGile
выполняется по Bearer-ключу, который хранится в переменной `YOUGILE_API_KEY`.

## Быстрый старт — локально (stdio)

```bash
npm install
npm run build
```

Добавь в конфиг MCP в Claude Desktop / Claude Code:

```json
{
  "mcpServers": {
    "yougile": {
      "command": "node",
      "args": ["/абсолютный/путь/к/dist/index.js"],
      "env": {
        "YOUGILE_API_KEY": "твой-ключ-yougile",
        "YOUGILE_USER_ID": "опционально-твой-userid-для-my_tasks"
      }
    }
  }
}
```

## Быстрый старт — удалённо (Cloudflare Workers)

```bash
npm install
npx wrangler login
npx wrangler secret put YOUGILE_API_KEY     # вставь ключ YouGile
npx wrangler secret put MCP_AUTH_TOKEN      # вставь случайную строку (openssl rand -hex 32)
npm run deploy
```

Получишь URL вида `https://yougile-mcp.<твой-сабдомен>.workers.dev`.

Проверка: `curl https://yougile-mcp.<...>.workers.dev/health` → `{"status":"ok"}`

### Подключение из claude.ai

Веб-интерфейс claude.ai не поддерживает кастомные HTTP-заголовки в коннекторах,
поэтому токен авторизации передаётся в URL:

1. https://claude.ai/settings/connectors → **Add custom connector**
2. URL: `https://yougile-mcp.<...>.workers.dev/<MCP_AUTH_TOKEN>/mcp`
3. Поля OAuth — оставь пустыми
4. Save → Claude подтянет 18 инструментов

### Подключение через curl / программные клиенты

Используй заголовок `Authorization: Bearer <token>`:

```bash
curl -X POST https://yougile-mcp.<...>.workers.dev/mcp \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Получение ключа API в YouGile

```bash
# 1. Узнай companyId
curl -X POST https://ru.yougile.com/api-v2/auth/companies \
  -H "Content-Type: application/json" \
  -d '{"login":"ТВОЯ_ПОЧТА","password":"ПАРОЛЬ"}'

# 2. Получи API-ключ (вставь companyId из шага 1)
curl -X POST https://ru.yougile.com/api-v2/auth/keys \
  -H "Content-Type: application/json" \
  -d '{"login":"ТВОЯ_ПОЧТА","password":"ПАРОЛЬ","companyId":"..."}'
```

## Структура проекта

```
src/
  index.ts           вход stdio (локальный режим)
  worker.ts          вход Cloudflare Workers (удалённый режим)
  server.ts          фабрика MCP-сервера, общая для обоих входов
  api/
    client.ts        HTTP-клиент YouGile + rate limiter
    types.ts         TypeScript-интерфейсы сущностей YouGile
  tools/
    index.ts         регистрация всех инструментов
    projects.ts boards.ts columns.ts users.ts
    tasks.ts         CRUD + move + complete
    stickers.ts      list + set
    chats.ts         add + get комментариев
    analytics.ts     board_summary, my_tasks, overdue_tasks
  utils/
    rate-limiter.ts  скользящее окно 45 запросов/мин
```

## Документация для AI-агентов

См. [AGENTS.ru.md](./AGENTS.ru.md) — полный справочник инструментов и
рекомендуемые сценарии работы агента с этим MCP-сервером.

## Лицензия

MIT
