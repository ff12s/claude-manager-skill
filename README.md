# claude-manager-skill

Скилл **`/manager`** для [Claude Code](https://claude.com/claude-code) — превращает Claude в дисциплинированного
tech-lead-оркестратора: он сам не пишет код, а декомпозирует задачу, подбирает профильного субагента из
установленных плагинов, **грунтуется в актуальной документации (context7)** и гоняет работу через **Review Loop**
с защитой от патологических циклов — вместо того чтобы сделать всё «на коленке» за один проход.

## Что он делает

- **Оркестрация, а не реализация.** На время работы скилла Claude — это менеджер: читает ровно столько, чтобы
  заскоупить задачу, и диспатчит специалистов, держа состояние оркестрации в собственном контексте.
- **Диспатч через Workflow на `opus` + `effort: 'xhigh'`.** Каждый специалист (writer / fixer / reviewer)
  запускается как `agent()` внутри Workflow, потому что только там можно зафиксировать одновременно и модель,
  и уровень reasoning. В комплекте — референсный скрипт Review Loop.
- **Documentation grounding (context7 first).** До первого диспатча, меняющего код, менеджер собирает бриф по
  актуальной документации каждой задетой библиотеки (API + best practices, с привязкой к версии из
  `requirements*.txt` / `pyproject.toml`) и прокидывает его в промпты writer / fixer / reviewer.
- **Review Loop с 5 рабочими гардами** (+ pre-guard на здоровье ревьюера): hard cap, sticky finding,
  no-progress, regression, diff-stagnation. Любой сработавший гард → STOP и эскалация пользователю, а не
  «молча едем дальше».
- **Полная таблица диспатча** по специальностям (Python/data, БД, backend/API, frontend, infra/DevOps,
  quality/security/debug, cross-cutting) с правилами разрешения имён и разбором коллизий
  (`code-reviewer`, `backend-developer`, `frontend-developer` есть и в voltagent, и локально).

## Установка

Скилл — это директория `skills/manager/` с единственным файлом `SKILL.md`. Чтобы Claude Code его подхватил,
положи её в `~/.claude/skills/`.

### macOS / Linux

```bash
git clone https://github.com/ff12s/claude-manager-skill.git
cp -r claude-manager-skill/skills/manager ~/.claude/skills/manager
```

### Windows (PowerShell)

```powershell
git clone https://github.com/ff12s/claude-manager-skill.git
Copy-Item -Recurse claude-manager-skill\skills\manager $env:USERPROFILE\.claude\skills\manager
```

После этого перезапусти сессию Claude Code — скилл появится в списке доступных.

## Использование

Вызови его явно:

```
/manager <твоя многошаговая задача>
```

…или просто попроси «use manager» / «orchestrate». Скилл рассчитан на задачи, затрагивающие больше одной
специальности (frontend + backend, код + инфра, код + тесты, пайплайн данных + тюнинг БД и т.п.).

## Зависимости и контекст

`SKILL.md` ссылается на конкретный набор плагинов, агентов и MCP-серверов, под который он написан:

- **Плагины-маркетплейсы:** `superpowers` (+ `context7`) из `claude-plugins-official`;
  `voltagent-core-dev` / `voltagent-data-ai` / `voltagent-infra` / `voltagent-qa-sec` из `voltagent-subagents`;
  `python-development` (+ `agent-orchestration`) из `claude-code-workflows`.
- **Локальные агенты** в `~/.claude/agents`: клон `awesome-claude-agents`, плюс `silent-failure-hunter` и
  `comment-analyzer`.
- **MCP-серверы:** `context7` (грунтовка по докам — обязательна), `codebase-memory-mcp` (индексированный
  обход кода), `postgres-statuses`, `ide`, опционально `github`.

Без этих компонентов скилл всё равно активируется, но часть диспатч-таблицы и MCP-инструментов будет
недоступна — таблицу под свой набор плагинов стоит подправить.

## Лицензия

[MIT](./LICENSE)