# YouGile MCP Server

[English](./README.md) | **Русский**

Расширенный MCP-сервер (Model Context Protocol) для российской системы управления задачами [YouGile](https://yougile.com). Позволяет Claude и любому AI-агенту с поддержкой MCP читать и изменять рабочее пространство YouGile на естественном языке: создавать задачи, управлять досками, ставить теги, писать комментарии, получать аналитику.

> **Основан на** [ra53n/yougile-mcp](https://github.com/ra53n/yougile-mcp) — добавлено 10 новых инструментов, исправлены баги, добавлена поддержка Linux.

---

## Что добавлено по сравнению с оригиналом

| Категория | Добавлено |
|---|---|
| Проекты | `create_project`, `update_project`, `delete_project` |
| Доски | `create_board`, `update_board`, `delete_board` |
| Колонки | `create_column`, `update_column`, `delete_column` |
| Аналитика | `list_tasks_by_project`, `company_overdue_tasks` |
| Файлы | `upload_file`, `attach_task_file` |
| Исправления | `my_tasks` починен (был 404), имена пользователей исправлены (поле `realName`) |

**Итого: 41 инструмент** (в оригинале было 28).

---

## Инструменты

### Навигация
| Инструмент | Описание |
|---|---|
| `list_projects` | Список всех проектов компании |
| `list_boards` | Список досок в проекте |
| `list_columns` | Список колонок на доске |
| `list_users` | Список пользователей (realName, email, isAdmin, status) |

### Задачи
| Инструмент | Описание |
|---|---|
| `list_tasks` | Список задач с фильтрами: columnId, assignedTo, поиск по названию |
| `get_task` | Получить задачу по ID или коду (например PRJ-123) |
| `create_task` | Создать задачу: название, колонка, описание, исполнители, дедлайн, стикеры |
| `update_task` | Обновить любые поля задачи |
| `delete_task` | Мягкое удаление задачи |
| `move_task` | Переместить задачу в другую колонку |
| `complete_task` | Отметить задачу выполненной |

### Управление структурой
| Инструмент | Описание |
|---|---|
| `create_project` | Создать проект (требует adminUserId — см. особенности API) |
| `update_project` | Переименовать проект |
| `delete_project` | Архивировать проект |
| `create_board` | Создать доску в проекте |
| `update_board` | Переименовать доску |
| `delete_board` | Архивировать доску |
| `create_column` | Создать колонку на доске |
| `update_column` | Переименовать или изменить цвет колонки |
| `delete_column` | Архивировать колонку |

### Теги (стикеры)
| Инструмент | Описание |
|---|---|
| `list_stickers` | Список стикеров на доске |
| `get_sticker` | Детали стикера и его состояния |
| `list_sprint_stickers` | Список спринт-стикеров (с временными рамками) |
| `create_sticker` | Создать новый тип стикера |
| `update_sticker` | Переименовать стикер |
| `delete_sticker` | Удалить тип стикера |
| `add_sticker_state` | Добавить состояние к стикеру |
| `update_sticker_state` | Переименовать состояние стикера |
| `delete_sticker_state` | Удалить состояние стикера |
| `set_task_stickers` | Установить все стикеры задачи сразу |
| `add_task_sticker` | Добавить один стикер к задаче |
| `remove_task_sticker` | Убрать стикер с задачи |

### Комментарии
| Инструмент | Описание |
|---|---|
| `add_task_comment` | Написать комментарий в чате задачи |
| `get_task_comments` | Получить историю комментариев задачи |

### Файлы
| Инструмент | Описание |
|---|---|
| `upload_file` | Загрузить локальный файл в хранилище YouGile, получить URL |
| `attach_task_file` | Загрузить локальный файл и опубликовать ссылку на него в чате задачи (у YouGile нет отдельного объекта "вложение" — это практический эквивалент) |

### Аналитика
| Инструмент | Описание |
|---|---|
| `board_summary` | Сводка по доске: счётчики, процент выполнения, просроченные, без исполнителя |
| `my_tasks` | Задачи пользователя по статусам (просроченные / в работе / выполненные) |
| `overdue_tasks` | Просроченные задачи на конкретной доске |
| `list_tasks_by_project` | Все задачи проекта (обходит доски → колонки → задачи) |
| `company_overdue_tasks` | Все просроченные задачи по всей компании |

---

## Требования

- **Node.js** ≥ 18 (тестировалось на v20)
- **npm** ≥ 9
- **API-ключ YouGile** (см. ниже)

---

## Установка

### Linux / macOS

```bash
# 1. Установить Node.js через nvm (не требует sudo)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc        # или: source ~/.zshrc
nvm install 20

# 2. Клонировать и собрать
git clone https://github.com/aLexDi-LLC/yougile-mcp
cd yougile-mcp
npm install
npm run build

# 3. Настроить
cp .env.example .env
nano .env               # вставить YOUGILE_API_KEY
```

### Windows

```powershell
# Установить Node.js (если не установлен)
winget install OpenJS.NodeJS.LTS

# Клонировать и собрать
git clone https://github.com/aLexDi-LLC/yougile-mcp
cd yougile-mcp
npm install
npm run build

# Настроить
copy .env.example .env
notepad .env            # вставить YOUGILE_API_KEY
```

---

## Получение API-ключа YouGile

**Вариант A — через приложение (быстрее):**
1. Открыть YouGile в браузере
2. Нажать `Ctrl + ~`
3. Скопировать API-ключ

**Вариант B — через API:**
```bash
# Шаг 1: получить companyId
curl -X POST https://ru.yougile.com/api-v2/auth/companies \
  -H "Content-Type: application/json" \
  -d '{"login":"ваш@email.com","password":"пароль"}'

# Шаг 2: получить API-ключ (использовать companyId из шага 1)
curl -X POST https://ru.yougile.com/api-v2/auth/keys/get \
  -H "Content-Type: application/json" \
  -d '{"login":"ваш@email.com","password":"пароль","companyId":"COMPANY_ID"}'
```

---

## Подключение к Claude Code (локально / stdio)

Добавить в `.mcp.json` проекта или `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "yougile": {
      "command": "node",
      "args": ["~/yougile-mcp/dist/index.js"],
      "env": {
        "YOUGILE_API_KEY": "ваш-api-ключ",
        "YOUGILE_USER_ID": "ваш-user-id-опционально"
      }
    }
  }
}
```

> **Linux с nvm:** укажите полный путь к node (узнать: `which node` после `nvm use 20`):
> `"/home/ВАШ_ПОЛЬЗОВАТЕЛЬ/.nvm/versions/node/v20.20.2/bin/node"`
>
> **Полный пример для Linux:**
> ```json
> {
>   "mcpServers": {
>     "yougile": {
>       "command": "/home/ВАШ_ПОЛЬЗОВАТЕЛЬ/.nvm/versions/node/v20.20.2/bin/node",
>       "args": ["/home/ВАШ_ПОЛЬЗОВАТЕЛЬ/yougile-mcp/dist/index.js"],
>       "env": { "YOUGILE_API_KEY": "ваш-api-ключ" }
>     }
>   }
> }
> ```

**Несколько организаций YouGile** — добавьте по одной записи на каждую:
```json
{
  "mcpServers": {
    "yougile-org1": { "command": "node", "args": ["..."], "env": { "YOUGILE_API_KEY": "ключ1" } },
    "yougile-org2": { "command": "node", "args": ["..."], "env": { "YOUGILE_API_KEY": "ключ2" } }
  }
}
```

Проверка: запустить `/mcp` в Claude Code — должно показать `yougile: connected`.

---

## Подключение к Claude Desktop

Редактировать конфиг:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "yougile": {
      "command": "node",
      "args": ["C:/Users/ВАШ_ПОЛЬЗОВАТЕЛЬ/yougile-mcp/dist/index.js"],
      "env": {
        "YOUGILE_API_KEY": "ваш-api-ключ"
      }
    }
  }
}
```

> **Пример Windows:** `C:/Users/Ivan/yougile-mcp/dist/index.js`  
> **Пример macOS:** `/Users/ivan/yougile-mcp/dist/index.js`

---

## Удалённый деплой (Cloudflare Workers)

```bash
npm install
npx wrangler login
npx wrangler secret put YOUGILE_API_KEY      # вставить YouGile-ключ
npx wrangler secret put MCP_AUTH_TOKEN       # openssl rand -hex 32
npm run deploy
```

Проверка: `curl https://yougile-mcp.<subdomain>.workers.dev/health`

Подключение через **claude.ai → Настройки → Коннекторы → Добавить:**
```
https://yougile-mcp.<subdomain>.workers.dev/<MCP_AUTH_TOKEN>/mcp
```

---

## Особенности API YouGile

| Проблема | Подробности |
|---|---|
| `create_project` требует `adminUserId` | Без него проект создаётся, но не отображается в списке |
| `create_column` — использовать `POST /columns` | `POST /boards/{id}/columns` возвращает 404; `boardId` передаётся в теле запроса |
| `my_tasks` — использует фильтр `assignedTo` | Эндпоинт `/users/{id}/tasks` не существует в API v2 |
| Поле имени пользователя | API возвращает `realName`, а не `firstName`/`lastName` |
| Лимит запросов | 45 запросов/мин на компанию — встроенный ограничитель обрабатывает очередь |
| `list_tasks` без `columnId` | Возвращает ограниченные результаты — всегда фильтровать по `columnId` или `assignedTo` |
| Нет объекта "вложение" | `POST /upload-file` возвращает только URL — "прикрепление" файла означает загрузку и последующую вставку этого URL как ссылки/`<img>` в описание или сообщение чата |
| `upload_file` / `attach_task_file` работают только в stdio-режиме | Читают локальный файл по пути — недоступны в удалённом деплое на Cloudflare Workers, там нет файловой системы |
| Загруженные файлы публичны | Полученный URL открывается без авторизации — никогда не загружайте секреты/учётные данные |

---

## Структура проекта

```
src/
  index.ts              stdio точка входа (локальный режим)
  worker.ts             Cloudflare Workers точка входа (удалённый режим)
  server.ts             фабрика MCP-сервера (общая)
  api/
    client.ts           HTTP-клиент YouGile + ограничитель запросов
    types.ts            TypeScript-интерфейсы
  tools/
    index.ts            регистрирует все 41 инструмент
    projects.ts         список + создание + обновление + удаление
    boards.ts           список + создание + обновление + удаление
    columns.ts          список + создание + обновление + удаление
    tasks.ts            CRUD + перемещение + завершение
    stickers.ts         управление стикерами и состояниями
    chats.ts            комментарии
    files.ts            upload_file, attach_task_file
    analytics.ts        сводки, просроченные, обход проекта
    users.ts            список пользователей
  utils/
    rate-limiter.ts     скользящее окно 45 запросов/мин
```

---

## Ссылки

- [ra53n/yougile-mcp](https://github.com/ra53n/yougile-mcp) — оригинальный сервер, на основе которого сделан этот
- [YouGile API v2](https://ru.yougile.com/api-v2/) — официальная документация REST API
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk) — TypeScript SDK для MCP
- [MCP спецификация](https://modelcontextprotocol.io) — документация протокола
- [Zod](https://github.com/colinhacks/zod) — валидация схем параметров
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) — платформа для удалённого деплоя

---

## Руководство для AI-агентов

Смотри [AGENTS.ru.md](./AGENTS.ru.md) — рекомендованные сценарии работы и цепочки вызовов.

---

## Лицензия

MIT
