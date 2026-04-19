# AGENTS.ru.md — Гайд для AI-агентов, использующих YouGile MCP

[English](./AGENTS.md) | **Русский**

Прочитай это перед использованием YouGile MCP. Описана модель данных, все 18
инструментов и рекомендованные цепочки вызовов для типовых сценариев.

## Модель данных

YouGile — иерархический трекер:

```
Компания (Company)
└─ Проект (Project)
   └─ Доска (Board)
      └─ Колонка (Column)        ← вертикальные дорожки (To Do, In Progress, Done…)
         └─ Задача (Task)
            ├─ Стикеры (Stickers)  — типизированные теги, у каждого опциональные состояния (например Priority=High)
            ├─ Назначенные пользователи (Assigned)  — массив user ID
            ├─ Дедлайн (Deadline)  — timestamp + опционально время дня
            └─ Чат задачи (Chat)  — комментарии
```

Чтобы найти что-то по имени, идти нужно сверху вниз: проект → доска → колонка
→ задача. Большинство фильтров требуют ID, а не имя. Сначала всегда резолви
имена в ID через `list_*` инструменты.

## Аутентификация и лимиты

- Аутентификация в YouGile делается на стороне сервера; ты не видишь API-ключ.
- Rate limit: 45 запросов/мин на компанию. Сервер сам ограничивает скользящим
  окном — если зовёшь слишком быстро, запросы встанут в очередь, а не упадут.
- Пагинация: list-инструменты автоматически пагинируются. Не думай об offset.
- Исключение: `list_tasks` НЕ автопагинируется (возвращает одну страницу до 50
  по умолчанию). Передавай `limit: 1000` для большего размера или используй
  узкие фильтры (`columnId` / `assignedTo`).

## Справочник инструментов

### Навигация (всегда начинай отсюда)

| Tool | Обязательные параметры | Возвращает |
|------|------------------------|------------|
| `list_projects` | — | `[{id, title}]` |
| `list_boards` | `projectId` | `[{id, title}]` |
| `list_columns` | `boardId` | `[{id, title, color}]` |
| `list_users` | — | `[{id, email, name}]` |

### CRUD задач

| Tool | Обязательные параметры | Примечания |
|------|------------------------|------------|
| `list_tasks` | — (фильтры: `columnId`, `assignedTo`, `title`, `limit`, `offset`) | Возвращает одну страницу |
| `get_task` | `id` | Принимает UUID или код задачи (например `"PRJ-123"`) |
| `create_task` | `title`, `columnId` | Опционально: `description`, `assigned`, `deadline`, `stickers` |
| `update_task` | `id` + любое из: `title`, `description`, `columnId`, `assigned`, `completed`, `archived`, `deadline`, `stickers` | Передавай только те поля, что хочешь изменить |
| `delete_task` | `id` | Мягкое удаление (`deleted: true`, восстанавливается из UI YouGile) |
| `move_task` | `id`, `columnId` | Сокращение для смены только колонки |
| `complete_task` | `id` | Сокращение для `completed: true` |

#### Формат дедлайна

```json
{
  "deadline": {
    "timestamp": 1735689600000,
    "startDate": 1735603200000,
    "withTime": true
  }
}
```

`timestamp` — дата дедлайна в миллисекундах. `withTime: true` означает что
важно время дня; `false` — дедлайн «весь день». `startDate` опционально.

### Стикеры (теги)

Стикеры в YouGile — типизированные ярлыки. У стикера есть имя (например
«Приоритет») и список состояний (например `["High", "Medium", "Low"]`). На
задаче стикеры хранятся как `{stickerId: stateId}` — значение это ID состояния,
а не его имя. Спецзначения на задаче: `"empty"` (стикер прикреплён без
состояния), `"-"` (открепить стикер).

#### Чтение стикеров

| Tool | Обязательные параметры | Примечания |
|------|------------------------|------------|
| `list_stickers` | — | Возвращает строковые стикеры с состояниями: `{id, name, color}` |
| `get_sticker` | `id` | Один стикер со всеми состояниями |
| `list_sprint_stickers` | — | Спринт-стикеры (у состояний есть `begin`/`end` в unix-секундах) |

#### CRUD стикеров

| Tool | Обязательные параметры | Примечания |
|------|------------------------|------------|
| `create_sticker` | `name` | Опционально `icon`, `states: [{name, color?}]` для начальных значений |
| `update_sticker` | `id` + `name` или `icon` | Только поля уровня стикера. Состояния меняй через инструменты ниже |
| `delete_sticker` | `id` | Soft-delete (`deleted: true`) |

#### CRUD состояний (значения внутри стикера)

| Tool | Обязательные параметры | Примечания |
|------|------------------------|------------|
| `add_sticker_state` | `stickerId`, `name` | Опционально `color` |
| `update_sticker_state` | `stickerId`, `stateId` + `name` / `color` / `deleted` | |
| `delete_sticker_state` | `stickerId`, `stateId` | Soft-delete одного состояния |

#### Применение стикеров к задачам

| Tool | Обязательные параметры | Примечания |
|------|------------------------|------------|
| `set_task_stickers` | `taskId`, `stickers` (полная карта) | **ЗАМЕНЯЕТ** все стикеры. Используй только когда осознанно хочешь перезаписать всё |
| `add_task_sticker` | `taskId`, `stickerId`, `stateId` | Ставит один стикер, остальные сохраняет. Внутри: read → merge → write |
| `remove_task_sticker` | `taskId`, `stickerId` | Шлёт `"-"` для этого стикера, остальные не трогает |

Для рутинной разметки задач используй `add_task_sticker` /
`remove_task_sticker`. `set_task_stickers` — низкоуровневый аварийный люк.

### Комментарии (чат задачи)

| Tool | Обязательные параметры | Примечания |
|------|------------------------|------------|
| `add_task_comment` | `taskId`, `text` | Опционально `label` для категоризации. Поддерживает plain text или HTML |
| `get_task_comments` | `taskId` | Возвращает всю историю чата с автопагинацией |

### Аналитика (несколько вызовов, может тормозить на больших досках)

| Tool | Обязательные параметры | Что делает |
|------|------------------------|------------|
| `board_summary` | `boardId` | Получает все колонки + все задачи в каждой. Возвращает `{totalTasks, completedCount, completedRatio, overdueCount, unassignedCount, columns: [{id, title, taskCount}]}`. Стоимость: 1 + N вызовов (N = число колонок) |
| `my_tasks` | `userId` (опционально, fallback на `YOUGILE_USER_ID` из env) | Возвращает задачи юзера, сгруппированные `overdue` / `inProgress` / `completed` / `unscheduled`. Стоимость: 1-N вызовов |
| `overdue_tasks` | `boardId` | Тот же fan-out что у `board_summary`, возвращает только просроченные, отсортированные по `daysOverdue` |

## Рекомендуемые сценарии

### «Создать задачу в проекте X, колонке Y, с тегом High priority»

1. `list_projects` → найди ID проекта
2. `list_boards` (с `projectId`) → найди ID доски
3. `list_columns` (с `boardId`) → найди ID нужной колонки
4. `list_stickers` → найди ID стикера «Приоритет» **и** ID его состояния
   `High` (оба возвращаются одним вызовом)
5. `create_task` с `title`, `columnId`, `stickers: {приоритетId: highStateId}`

Кешируй ID проекта/доски/колонок в контексте — они стабильны.

### «Покажи обзор доски»

Один вызов: `board_summary` с `boardId`.

### «Что у меня на тарелке?»

Один вызов: `my_tasks` с `userId`.

### «Перенеси задачу в Done и оставь комментарий»

```
move_task(id=T, columnId=DONE_COLUMN_ID)
# либо: complete_task(id=T) если важен флаг completed
add_task_comment(taskId=T, text="Готово. PR: https://github.com/...")
```

### Цикл автономного dev-агента (целевой кейс этого сервера)

1. `list_tasks(columnId=AGENT_COLUMN_ID)` → забрать очередь
2. Отфильтровать задачи со стикером `agent-status: queued`
3. Для каждой (не более 1-3 за запуск):
   а) `set_task_stickers(taskId=T, stickers={agentStatusId: inProgressStateId})`
   б) `add_task_comment(taskId=T, text="Agent started. Branch: agent/task-{id}")`
   в) Прочитать `CLAUDE.md` из репо — это правила
   г) Реализовать, прогнать тесты, запушить, `gh pr create`
   д) `add_task_comment(taskId=T, text="PR ready: <url>")`
   е) `set_task_stickers(taskId=T, stickers={agentStatusId: prReadyStateId})`
   ж) При падении: `set_task_stickers` в `failed` + `add_task_comment` с ошибкой

## Типичные грабли

- **Получить все задачи доски целиком**: фильтра по `boardId` в `list_tasks`
  нет. Нужно итерировать колонки. Если важны только числа — используй
  `board_summary`.
- **Получить все задачи проекта**: то же самое — фильтра по `projectId` нет.
  Идти доски → колонки → задачи.
- **ID состояний стикеров**: `list_stickers` и `get_sticker` теперь
  возвращают полные объекты состояний с `id`, `name`, `color`. Используй
  `id` при записи в поле `stickers` задачи.
- **Мягкое удаление**: `delete_task` ставит `deleted: true` — задача скрыта,
  но восстанавливается из UI YouGile во вкладке «Удалённые».
- **Код задачи vs UUID**: `get_task` принимает оба, но `update_task`,
  `move_task` и т.д. ждут UUID. Если есть только код — сначала позови
  `get_task` чтобы получить UUID.

## Обработка ошибок

Все инструменты возвращают ошибки в виде MCP tool errors с подробным сообщением:
HTTP-метод, путь, статус-код и тело ответа YouGile. Если 401 — API-ключ YouGile
неверный или отозван. Если 429 — встроенного rate limiter не хватило, подожди
минуту. Если 404 на только что созданной задаче — возможно по ней прошёл
soft-delete.
