# AGENTS.ru.md — YouGile MCP: Гайд для AI-агентов

[English](./AGENTS.md) | **Русский**

Этот файл предназначен **для AI-агентов** — он автоматически загружается в контекст фреймворками вроде Claude Code. Прочитай его перед первым вызовом инструментов YouGile.

> Этот MCP-сервер работает с **любым AI, поддерживающим Model Context Protocol**: Claude, GPT-4o, Gemini, Qwen, GigaChat, Mistral и локальными моделями через MCP-мосты.

---

## 1. Модель данных

YouGile — иерархический трекер задач:

```
Компания (Company)
└─ Проект (Project)
   └─ Доска (Board)
      └─ Колонка (Column)   ← дорожки: Бэклог / В работе / Готово / и т.д.
         └─ Задача (Task)
            ├─ Стикеры (Stickers)  — типизированные теги с состояниями (напр. Приоритет=Высокий)
            ├─ Исполнители (Assigned) — массив user ID
            ├─ Дедлайн (Deadline)  — timestamp в мс + флаг времени
            └─ Чат (Chat)          — комментарии (chatId == taskId)
```

**Правило навигации:** все операции требуют ID, а не названия. Всегда резолви названия → ID сверху вниз:
`list_projects` → `list_boards` → `list_columns` → потом действуй.

---

## 2. Аутентификация и лимиты

- API-ключ инжектируется на стороне сервера через `YOUGILE_API_KEY`. Агент его не видит.
- Лимит запросов: **45 в минуту** на компанию. Сервер сам ставит запросы в очередь — ошибки 429 не будет.
- Все `list_*` инструменты автоматически пагинируются. Про offset можно забыть.
- Исключение: `list_tasks` возвращает одну страницу (по умолчанию 50). Используй `columnId` / `assignedTo` или передай `limit: 1000`.

---

## 3. Справочник инструментов — все 41

### Навигация

| Инструмент | Параметры | Возвращает |
|---|---|---|
| `list_projects` | — | `[{id, title}]` |
| `list_boards` | `projectId` | `[{id, title}]` |
| `list_columns` | `boardId` | `[{id, title, color}]` |
| `list_users` | — | `[{id, email, name, isAdmin, status}]` |

### CRUD задач

| Инструмент | Обязательные | Опциональные | Примечания |
|---|---|---|---|
| `list_tasks` | — | `columnId`, `assignedTo`, `title`, `limit`, `offset` | Всегда фильтруй |
| `get_task` | `id` | — | UUID или код задачи (напр. `PRJ-123`) |
| `create_task` | `title`, `columnId` | `description`, `assigned[]`, `deadline`, `stickers` | Возвращает `{id}` |
| `update_task` | `id` | любое поле | Передавай только изменяемые поля |
| `delete_task` | `id` | — | Мягкое удаление — восстанавливается в UI |
| `move_task` | `id`, `columnId` | — | Ярлык для смены колонки |
| `complete_task` | `id` | — | Ставит `completed: true` |

**Формат дедлайна:**
```json
{ "timestamp": 1735689600000, "startDate": 1735603200000, "withTime": true }
```
`timestamp` — дата дедлайна в **миллисекундах**. `withTime: false` = дедлайн «весь день».

### Управление структурой (создание / переименование / удаление)

| Инструмент | Обязательные | Примечания |
|---|---|---|
| `create_project` | `title` | Обязательно передай `adminUserId` (или задай `YOUGILE_USER_ID` env) — иначе проект создастся но будет **невидим** |
| `update_project` | `id`, `title` | Переименование |
| `delete_project` | `id` | Архивирование |
| `create_board` | `title`, `projectId` | — |
| `update_board` | `id`, `title` | Переименование |
| `delete_board` | `id` | Архивирование |
| `create_column` | `title`, `boardId` | Использует `POST /columns` с `boardId` в теле — НЕ `POST /boards/{id}/columns` (возвращает 404) |
| `update_column` | `id` | Опционально: `title`, `color` |
| `delete_column` | `id` | Архивирование |

### Стикеры (типизированные теги)

Стикеры = типы ярлыков (напр. «Приоритет») с состояниями (напр. «Высокий», «Средний», «Низкий»).
На задаче: `stickers: { stickerId: stateId }`. Спецзначения: `"empty"` = без состояния, `"-"` = открепить.

| Инструмент | Обязательные | Примечания |
|---|---|---|
| `list_stickers` | — | Все типы стикеров и их состояния |
| `get_sticker` | `id` | Один стикер со всеми состояниями |
| `list_sprint_stickers` | — | Спринт-стикеры (у состояний есть `begin`/`end`) |
| `create_sticker` | `name` | Опционально: `icon`, `states: [{name, color}]` |
| `update_sticker` | `id` | Опционально: `name`, `icon` |
| `delete_sticker` | `id` | Мягкое удаление |
| `add_sticker_state` | `stickerId`, `name` | Опционально: `color` |
| `update_sticker_state` | `stickerId`, `stateId` | Опционально: `name`, `color`, `deleted` |
| `delete_sticker_state` | `stickerId`, `stateId` | Мягкое удаление |
| `set_task_stickers` | `taskId`, `stickers` | **ЗАМЕНЯЕТ ВСЕ** стикеры — используй осторожно |
| `add_task_sticker` | `taskId`, `stickerId`, `stateId` | Добавляет один, остальные сохраняет |
| `remove_task_sticker` | `taskId`, `stickerId` | Убирает один, остальные сохраняет |

Для рутинного тегирования предпочитай `add_task_sticker` / `remove_task_sticker`. `set_task_stickers` — низкоуровневый override.

### Комментарии

| Инструмент | Обязательные | Примечания |
|---|---|---|
| `add_task_comment` | `taskId`, `text` | Опционально `label`. Поддерживает plain text и HTML |
| `get_task_comments` | `taskId` | Полная история чата с автопагинацией |

### Файлы

| Инструмент | Обязательные | Примечания |
|---|---|---|
| `upload_file` | `filePath` | Загружает локальный файл, возвращает `{ result, url, fullUrl }`. У YouGile нет объекта "вложение" — `fullUrl` это просто ссылка, которую нужно вставить самостоятельно |
| `attach_task_file` | `taskId`, `filePath` | Загружает файл и публикует ссылку на него в чате задачи одним вызовом — практический способ "прикрепить" файл |

⚠️ Оба читают локальный файл по пути — работают только в stdio (локальном) режиме, недоступны при удалённом деплое на Cloudflare Workers. Полученный URL публичный, авторизация не нужна — никогда не загружайте секреты/учётные данные.

### Аналитика

| Инструмент | Параметры | Что делает | Стоимость вызовов |
|---|---|---|---|
| `board_summary` | `boardId` | Счётчики задач по колонкам, % выполнения, просроченные, без исполнителя | 1 + N |
| `my_tasks` | `userId` (опц.) | Задачи пользователя: overdue / inProgress / completed / unscheduled | 1 |
| `overdue_tasks` | `boardId` | Просроченные задачи на доске, отсортированные по `daysOverdue` | 1 + N |
| `list_tasks_by_project` | `projectId` | **Все задачи** проекта — обходит доски → колонки → задачи. `includeCompleted: false` пропускает выполненные | Много |
| `company_overdue_tasks` | — | **Все просроченные** по всей компании — обходит все проекты | Много |

⚠️ `list_tasks_by_project` и `company_overdue_tasks` делают много API-вызовов. Используй редко на больших воркспейсах.

---

## 4. Рекомендуемые сценарии

### Найти задачу по названию
```
list_projects → найди проект
list_boards(projectId) → найди доску
list_columns(boardId) → получи ID колонок
list_tasks(columnId=X, title="поисковый запрос")
```

### Создать задачу с тегом приоритета
```
1. list_projects → projectId
2. list_boards(projectId) → boardId
3. list_columns(boardId) → columnId нужной колонки
4. list_stickers → найди id стикера «Приоритет» и id состояния «Высокий»
5. create_task(title, columnId, stickers={prioritetId: highStateId})
```

### Обзор всех задач проекта
```
list_tasks_by_project(projectId, includeCompleted=false)
```

### Отчёт для ежедневного стендапа
```
my_tasks(userId)  →  секции overdue + inProgress
```

### Найти все просроченные по всей компании
```
company_overdue_tasks()   ← один вызов, без параметров
```

### Завершить задачу и зафиксировать результат
```
complete_task(id)
add_task_comment(taskId=id, text="Готово. Результат: ...")
```

### Цикл автономного агента (CI/CD интеграция)
```
1. list_tasks(columnId=QUEUE_COLUMN)
2. Отфильтровать задачи со стикером agent-status=queued
3. Для каждой (не более 3 за запуск):
   а) add_task_sticker(taskId, agentStatusId, inProgressStateId)
   б) add_task_comment(taskId, "Старт. Ветка: feature/task-{id}")
   в) ... выполнить работу ...
   г) add_task_comment(taskId, "Готово. PR: https://...")
   д) add_task_sticker(taskId, agentStatusId, doneStateId)
   е) move_task(taskId, columnId=REVIEW_COLUMN)
   ж) При ошибке: add_task_sticker → failedStateId + add_task_comment с ошибкой
```

### Создать проект с нуля
```
1. list_users → получи свой userId
2. create_project(title="Мой проект", adminUserId=userId)
3. create_board(title="Основная доска", projectId=newProjectId)
4. create_column(title="Бэклог", boardId=newBoardId)
5. create_column(title="В работе", boardId=newBoardId)
6. create_column(title="Готово", boardId=newBoardId)
7. create_task(title="Первая задача", columnId=backlogColumnId)
```

---

## 5. Типичные ошибки

| Ошибка | Правильный подход |
|---|---|
| `list_tasks` без фильтра возвращает пусто | Всегда используй `columnId` или `assignedTo` |
| `create_project` без `adminUserId` | Проект невидим — всегда передавай |
| `create_column` через URL `/boards/{id}/columns` | Неверно — используй `POST /columns` с `boardId` в теле |
| Передаёшь **название** состояния стикера вместо **ID** | Сначала вызови `list_stickers`, используй `state.id` |
| `move_task` vs `complete_task` | `move_task` меняет только колонку; `complete_task` ставит флаг `completed` |
| Код задачи (PRJ-123) в `update_task` | Не работает — сначала `get_task("PRJ-123")` чтобы получить UUID |
| `company_overdue_tasks` на 100+ задачах | Медленно — много API-вызовов, ограничены 45/мин |

---

## 6. Подсказки для разных AI-фреймворков

Скопируй нужный фрагмент в системный промпт при интеграции этого MCP-сервера.

### Claude (Claude Code / Claude Desktop)
```
У тебя есть доступ к MCP-серверу YouGile (префикс инструментов: mcp__yougile__).
Иерархия YouGile: Компания → Проект → Доска → Колонка → Задача.
Всегда навигируй сверху вниз: list_projects → list_boards → list_columns, прежде чем создавать или обновлять задачи.
Используй list_tasks с фильтрами columnId или assignedTo — никогда без фильтров.
Для всех задач проекта: list_tasks_by_project(projectId).
Для отчёта по просроченным по всей компании: company_overdue_tasks().
При создании проекта всегда передавай adminUserId (получи из list_users).
Кешируй ID в контексте — они не меняются в рамках сессии.
```

### OpenAI GPT-4o / GPT-4-turbo (через MCP-мост)
```
У тебя есть инструменты управления задачами YouGile через MCP.
Соглашение по именованию: list_projects, list_boards, list_columns, list_tasks, create_task, update_task и т.д.
ВАЖНО: YouGile требует ID для всех операций. Сначала вызывай list_projects, потом list_boards, потом list_columns, чтобы резолвить названия в ID, а только потом действуй.
Для всех задач проекта: list_tasks_by_project. Для просроченных по всей компании: company_overdue_tasks.
Никогда не вызывай list_tasks без фильтра columnId или assignedTo.
```

### Google Gemini (через MCP-мост)
```
Ты подключён к системе управления задачами YouGile через MCP-инструменты.
Иерархия данных: Project > Board > Column > Task.
Всегда начинай с list_projects чтобы узнать структуру воркспейса, затем углубляйся.
Используй board_summary(boardId) для быстрой аналитики доски.
Используй my_tasks(userId) для списка задач пользователя, сгруппированных по срочности.
Используй company_overdue_tasks() (без параметров) для всех просроченных по всем проектам.
```

### Qwen / Alibaba (через MCP-мост)
```
Тебе доступны инструменты управления задачами YouGile.
Начинай каждую сессию с list_projects чтобы понять структуру воркспейса.
Обязательная последовательность: list_projects → list_boards(projectId) → list_columns(boardId) → потом операции с задачами.
Для создания задачи: create_task требует как минимум title и columnId.
Для списка задач проекта: list_tasks_by_project(projectId, includeCompleted=false) пропускает выполненные.
```

### GigaChat / Сбер (через MCP-мост)
```
Тебе доступны инструменты управления задачами YouGile через MCP.
Иерархия данных: Компания → Проект → Доска → Колонка → Задача.
Перед любым действием с задачей получи нужные ID: list_projects → list_boards → list_columns.
Для всех задач проекта: list_tasks_by_project(projectId).
Для отчёта по просроченным по всей компании: company_overdue_tasks() без параметров.
Для дашборда доски: board_summary(boardId).
```

### Ollama / Локальные модели (через mcp-bridge или LM Studio)
```
У тебя есть инструменты управления задачами YouGile через MCP.
Ключевые правила:
1. Все инструменты требуют ID, а не названия. Сначала используй list_* для получения ID.
2. Порядок навигации: list_projects → list_boards → list_columns → list_tasks
3. list_tasks ОБЯЗАТЕЛЬНО должен иметь фильтр columnId или assignedTo, иначе вернёт пустой результат.
4. Для всех задач проекта: list_tasks_by_project(projectId)
5. Для всех просроченных: company_overdue_tasks() без параметров
6. Для состояний стикеров нужен их ID: сначала вызови list_stickers.
```

### LangChain / LangGraph (Python)
```python
# При использовании через langchain-mcp-adapters
system_prompt = """
You have YouGile task management tools available.
Navigation: list_projects → list_boards(projectId) → list_columns(boardId) → list_tasks(columnId=...)
Never call list_tasks without columnId or assignedTo filter.
For project-wide tasks: list_tasks_by_project(projectId).
For company overdue: company_overdue_tasks() with no arguments.
All IDs are UUIDs. Task codes (PRJ-123) work only in get_task.
"""
```

---

## 7. MCP-совместимость

Этот сервер реализует **Model Context Protocol (MCP)** с транспортом stdio. Совместим с любым клиентом, поддерживающим MCP:

| Клиент | Поддержка | Примечания |
|---|---|---|
| **Claude Code** | ✅ Нативная | Конфиг в `.mcp.json` |
| **Claude Desktop** | ✅ Нативная | Конфиг в `claude_desktop_config.json` |
| **OpenAI GPT** | ⚠️ Через мост | [mcp-bridge](https://github.com/bartolli/mcp-bridge) или аналоги |
| **Google Gemini** | ⚠️ Через мост | Google AI Studio MCP (экспериментально) |
| **Qwen** | ⚠️ Через мост | Любой OpenAI-совместимый MCP-мост |
| **GigaChat** | ⚠️ Через мост | Требует кастомный MCP-адаптер |
| **Mistral** | ⚠️ Через мост | Через OpenAI-совместимый мост |
| **Ollama / LM Studio** | ⚠️ Через мост | [mcp-bridge](https://github.com/bartolli/mcp-bridge) |
| **LangChain / LangGraph** | ⚠️ Через адаптер | Пакет `langchain-mcp-adapters` |
| **AutoGen** | ⚠️ Через адаптер | MCP tool adapter |

**Удалённый режим** (Cloudflare Workers / HTTP транспорт) совместим с любым HTTP-клиентом без моста.

---

## 8. Справочник ошибок

| HTTP-статус | Значение | Действие |
|---|---|---|
| `401` | Неверный или отозванный API-ключ | Пересоздай ключ через `Ctrl+~` в YouGile |
| `404` | Сущность не найдена или эндпоинт не существует | Проверь ID; некоторые эндпоинты отсутствуют в API v2 (напр. `/users/{id}/tasks`) |
| `429` | Лимит запросов (не должно случаться — есть встроенный ограничитель) | Подожди 1 минуту |
| `400` | Неверное тело запроса | Проверь обязательные поля; `create_project` требует `adminUserId` |
