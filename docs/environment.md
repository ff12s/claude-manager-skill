# Окружение Claude Code

Снимок того, что установлено в Claude Code на рабочей машине (user scope). Актуально на **2026-07-01**.
Это справка о среде, в которой работает `/manager` — она объясняет, откуда берутся субагенты, скиллы и MCP-инструменты,
которые диспатчит скилл. Список субагентов по специальностям и правила разрешения имён — в
[`skills/manager/references/toolbox.md`](../skills/manager/references/toolbox.md) и `dispatch-table.md`.

## Marketplaces (источники плагинов)

| Marketplace | Репозиторий | Что даёт |
|---|---|---|
| `claude-plugins-official` | [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | Официальные плагины Anthropic (superpowers, context7) |
| `claude-code-workflows` | [wshobson/agents](https://github.com/wshobson/agents) | Основной набор профильных субагентов и скиллов по доменам |
| `voltagent-subagents` | [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | Доп. субагенты (оставлены только под «сирот»: postgres-pro, pentester, powershell и т.п.) |
| `caveman` | [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) | Сжатие вывода (token compression) |

## Плагины (enabled, user scope)

### `claude-plugins-official`
- **superpowers** `6.1.0` — [репо](https://github.com/anthropics/claude-plugins-official) — фреймворк дисциплин: TDD, brainstorming, writing-plans, systematic-debugging, using-git-worktrees и др. Управляет тем, «как» вести работу.
- **context7** — [репо](https://github.com/anthropics/claude-plugins-official) — подключает MCP-сервер актуальной документации библиотек (см. ниже). Основа грунтовки `/manager`.

### `claude-code-workflows` ([wshobson/agents](https://github.com/wshobson/agents))
Основной поставщик субагентов и доменных скиллов. Установлены:

| Плагин | Версия | Домен |
|---|---|---|
| `python-development` | 1.2.3 | Python: django/fastapi/async, стиль, тестирование, упаковка |
| `backend-development` | 1.3.2 | API-дизайн, микросервисы, event sourcing / CQRS / saga |
| `database-cloud-optimization` | 1.2.1 | Схемы, оптимизация запросов, cloud-архитектура |
| `data-engineering` | 1.3.2 | Пайплайны, Airflow, dbt, Spark, data quality |
| `machine-learning-ops` | 1.2.2 | MLOps, обучение/сервинг моделей |
| `llm-application-dev` | 2.0.6 | LLM-приложения, RAG, эмбеддинги, prompt engineering |
| `frontend-mobile-development` | 1.2.3 | React/Next.js, React Native, state management |
| `ui-design` | 1.0.5 | Дизайн-системы, доступность, компоненты |
| `cloud-infrastructure` | 1.3.2 | Multi-cloud, Terraform, service mesh, сети |
| `kubernetes-operations` | 1.2.3 | K8s-манифесты, Helm, GitOps, security policies |
| `cicd-automation` | 1.2.3 | CI/CD пайплайны, GitHub Actions, GitLab CI, секреты |
| `incident-response` | 1.3.2 | Инцидент-менеджмент, debugging, postmortem, runbooks |
| `comprehensive-review` | 1.3.1 | Многомерное код-ревью (architect / code / security) — ревьюеры `/manager` |
| `agent-orchestration` | 1.2.2 | context-manager для оркестрации |

### `voltagent-subagents` ([VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents))
- **voltagent-data-ai** `1.0.2` — data/AI субагенты.
- **voltagent-qa-sec** `1.1.1` — QA/security субагенты.

Оставлены **только ради «сирот»**, которых нет в `wshobson/agents`: `postgres-pro`, `penetration-tester`,
`powershell-security-hardening`, `chaos-engineer`, `qa-expert`, `compliance-auditor`. Для общих ролей приоритет —
`claude-code-workflows`.

### `caveman` ([JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman))
- **caveman** `25d22f8` — сжатие вывода (~65% меньше output-токенов, «caveman speak»); всегда включён через
  SessionStart-хук манифеста плагина, уровень по умолчанию `full`. Сохраняет код/API/язык. Команда `/caveman [lite|full|ultra]`.

### Объявлены, но не загружаются
`great_cto@local`, `superpowers@local`, `beads@local` — включены в `settings.json`, но marketplace `local`
не зарегистрирован и записей об установке нет → фактически «висячие» ссылки. Либо зарегистрировать локальный
marketplace, либо убрать из `enabledPlugins`.

## MCP-серверы

| Сервер | Транспорт / команда | Назначение | Статус |
|---|---|---|---|
| `context7` (`plugin:context7`) | `npx -y @upstash/context7-mcp` — [Upstash Context7](https://github.com/upstash/context7) | Актуальная документация библиотек; грунтовка `/manager` | ✔ |
| `codebase-memory-mcp` | локальный `codebase-memory-mcp.exe` | Граф кода: `search_graph` / `trace_path` / `get_code_snippet` | ✔ |
| локальный Postgres (имя redacted) | `@modelcontextprotocol/server-postgres` → локальная рабочая БД (имя и креды redacted) | Read-only SQL для инспекции локальной БД проекта | ✔ |
| `jetbrains` | HTTP `127.0.0.1:64342/stream` | Интеграция с PyCharm (правки/поиск/рефактор в IDE) | ✔ |
| `github` | HTTP `api.githubcopilot.com/mcp` — GitHub Copilot MCP | GitHub-операции | ✘ не подключён |

> Порт JetBrains MCP привязан к запущенному PyCharm и может меняться — см. `references/toolbox.md`.

## Локальные скиллы (`~/.claude/skills/`)

- **manager** → junction на этот репозиторий ([ff12s/claude-manager-skill](https://github.com/ff12s/claude-manager-skill), `skills/manager/`) — единственный источник, без дрейфа.
- **codebase-memory** — обёртка над codebase-memory-mcp (граф кода).
- **architecture-decision-records** — фиксация ADR по ходу сессий.
- **context-budget** — аудит потребления контекстного окна.
- **playwright-cli** — автоматизация браузера / Playwright-тесты.

Плюс скиллы, поставляемые плагинами (superpowers:*, python-development:*, comprehensive-review:* и т.д.) —
подхватываются автоматически.

## Кастомные хуки (`~/.claude/hooks/`)

- **cbm-code-discovery-gate** — `PreToolUse` на `Grep|Glob|Read|Search`: напоминает сначала идти в codebase-memory-mcp.
- **cbm-session-reminder** — `SessionStart` (startup/resume/clear/compact): протокол code discovery + superpowers.

Оба завязаны на рабочий процесс codebase-memory-mcp.

---

*Как пересобрать снимок:* `claude plugin list`, `claude mcp list`, `~/.claude/settings.json`
(`enabledPlugins` + `hooks`), `~/.claude/plugins/{known_marketplaces,installed_plugins}.json`, `ls ~/.claude/skills ~/.claude/hooks`.