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

## Структура

Скилл — это директория `skills/manager/`: тонкое поведенческое тело `SKILL.md` плюс материалы, читаемые по
требованию, в `references/` (progressive disclosure — тело держится под 500 строк).

```
skills/manager/
├── SKILL.md                 # поведенческое ядро + навигация по references/
└── references/
    ├── review-loop.md       # Workflow-скрипт Review Loop + схемы + детальные шаги
    ├── dispatch-table.md    # полная таблица диспатча + разрешение имён + коллизии
    ├── toolbox.md           # инвентарь скиллов / MCP / плагинов и агентов
    └── grounding.md         # детальная процедура context7-грунтовки
```

## Установка

Чтобы Claude Code подхватил скилл, положи всю директорию `skills/manager/` (вместе с `references/`) в
`~/.claude/skills/`.

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

### Разработка скилла (один источник истины)

Локально живая папка `~/.claude/skills/manager` сделана **directory junction** на `skills/manager` этого репо
(`New-Item -ItemType Junction` на Windows; `ln -s` на *nix), поэтому репозиторий — единственный источник
истины: правки делаются в репо, дрейфа между живой папкой и git нет. Команды `cp` / `Copy-Item` выше — для
обычной установки другими пользователями (они копируют всю папку, включая `references/`).

## Использование

Вызови его явно:

```
/manager <твоя многошаговая задача>
```

…или просто попроси «use manager» / «orchestrate». Скилл рассчитан на задачи, затрагивающие больше одной
специальности (frontend + backend, код + инфра, код + тесты, пайплайн данных + тюнинг БД и т.п.).

## Зависимости и установка компонентов

`SKILL.md` ссылается на конкретный набор плагинов, агентов и MCP-серверов. Ниже — полный список с командами
установки. Без этих компонентов скилл активируется, но часть диспатч-таблицы будет недоступна — таблицу под
свой набор плагинов стоит подправить (`references/dispatch-table.md`).

### 1. Плагины-маркетплейсы (устанавливаются через Claude Code)

Плагины устанавливаются из встроенного маркетплейса Claude Code: откройте `/marketplace` или пропишите
плагины в `~/.claude/settings.json` → `"plugins"`.

#### `claude-plugins-official` → пакет `superpowers` + `context7`

- **superpowers** — процессный фреймворк (brainstorming / TDD / systematic-debugging / review-loop).
  Без него скилл не работает — это его процессный скелет.
- **context7** (MCP-сервер) — текущая документация библиотек. Обязателен для grounding-шага.

Источник: официальный маркетплейс Claude Code (`claude-plugins-official`).

#### `claude-code-workflows` (wshobson) → **основной набор агентов**

GitHub: <https://github.com/wshobson/claude-code-workflows>

Маркетплейс с 83 бандлами (191 агент). `/manager` использует эти бандлы:

| Бандл | Ключевые агенты |
|---|---|
| `comprehensive-review` | `comprehensive-review-code-reviewer` (Review Loop), `comprehensive-review-security-auditor`, `comprehensive-review-architect-review` |
| `python-development` | `python-pro`, `python-development-fastapi-pro`, `python-development-django-pro` |
| `backend-development` | `backend-development-backend-architect`, `backend-development-test-automator` (TESTER) |
| `incident-response` | `debugger`, `error-detective`, `test-automator` |
| `data-engineering` | `data-engineer` |
| `machine-learning-ops` | `data-scientist`, `ml-engineer`, `mlops-engineer` |
| `llm-application-dev` | `ai-engineer`, `prompt-engineer`, `vector-database-engineer` |
| `database-cloud-optimization` | `database-optimizer`, `database-architect` |
| `cloud-infrastructure` | `cloud-architect`, `terraform-specialist`, `deployment-engineer`, `network-engineer`, `service-mesh-expert` |
| `kubernetes-operations` | `kubernetes-architect` |
| `cicd-automation` | `deployment-engineer`, `devops-troubleshooter` |
| `frontend-mobile-development` | `frontend-developer`, `mobile-developer` |
| `ui-design` | `ui-designer`, `design-system-architect`, `accessibility-expert` |
| `agent-orchestration` | `context-manager` |

**Агентыon-demand (не установлены по умолчанию):** `systems-programming`, `javascript-typescript`,
`jvm-languages`, `web-scripting`, `functional-programming`, `database-design`, `shell-scripting` — устанавливаются при необходимости.

#### `voltagent-subagents` (VoltAgent) → **только для orphan-агентов**

GitHub: <https://github.com/VoltAgent/awesome-claude-code-subagents>

Из всего пакета установлены только два плагина для агентов, которых нет у wshobson:

| Плагин | Агенты |
|---|---|
| `voltagent-qa-sec` | `penetration-tester`, `powershell-security-hardening`, `chaos-engineer`, `qa-expert`, `compliance-auditor`, `gdpr-ccpa-compliance` |
| `voltagent-data-ai` | `postgres-pro` |

`voltagent-core-dev` и `voltagent-infra` **удалены** — не диспатчьте их старые имена.

### 2. Локальные агенты (`~/.claude/agents/`)

Локальные агенты — bare-name (без `bundle:` префикса). Клонируются в `~/.claude/agents/`.

#### awesome-claude-agents — базовая библиотека агентов

Набор кросс-стековых агентов (cross-language, universal). Клонируйте в `~/.claude/agents/`:

```bash
# macOS / Linux
git clone https://github.com/anthropics/awesome-claude-agents ~/.claude/agents/awesome-claude-agents
# или по одному нужному агенту — каждый агент это отдельный .md-файл
```

```powershell
# Windows (PowerShell)
git clone https://github.com/anthropics/awesome-claude-agents "$env:USERPROFILE\.claude\agents\awesome-claude-agents"
```

Включает: `code-archaeologist`, `code-reviewer`, `documentation-specialist`, `performance-optimizer`,
`project-analyst`, `team-configurator`, `tech-lead-orchestrator`, `api-architect`, `backend-developer`,
`frontend-developer`, `tailwind-frontend-expert` — и стековые специалисты (Django, FastAPI, Rails, Laravel, React, Vue, …).

#### `silent-failure-hunter` и `comment-analyzer` — специализированные ревьюеры

Источник: <https://github.com/affaan-m/ECC> (Enhanced Claude Code).

```bash
# macOS / Linux — скопировать нужные .md-файлы агентов в ~/.claude/agents/
git clone https://github.com/affaan-m/ECC /tmp/ecc
cp /tmp/ecc/agents/silent-failure-hunter.md ~/.claude/agents/
cp /tmp/ecc/agents/comment-analyzer.md ~/.claude/agents/
```

```powershell
# Windows (PowerShell)
git clone https://github.com/affaan-m/ECC "$env:TEMP\ecc"
Copy-Item "$env:TEMP\ecc\agents\silent-failure-hunter.md" "$env:USERPROFILE\.claude\agents\"
Copy-Item "$env:TEMP\ecc\agents\comment-analyzer.md" "$env:USERPROFILE\.claude\agents\"
```

### 3. MCP-серверы

| Сервер | Обязателен | Назначение | Установка |
|---|---|---|---|
| `context7` | **да** | Grounding по актуальной документации библиотек | Входит в плагин `context7` (`claude-plugins-official`) |
| `codebase-memory-mcp` | нет | Индексированный обход кода (graph-based) — значительно ускоряет разведку репо | [Отдельная установка](https://github.com/some-repo/codebase-memory-mcp) — настраивается через `mcpServers` в `~/.claude/settings.json` |
| `ide` | нет | LSP / диагностика open-файлов | Встроен в Claude Code IDE-расширение |
| `github` | нет | PR / Issue / API GitHub | Официальный MCP сервер от GitHub — настраивается через `mcpServers` |

## Лицензия

[MIT](./LICENSE)