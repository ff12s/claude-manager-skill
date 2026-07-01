# Toolbox inventory — skills, MCP servers, plugins & agents

Read this when you need the full inventory behind the body's compact toolbox/priority notes
(see `../SKILL.md` → "Toolbox priority"). The body holds the superpowers-first principle; this holds the lists.

## Contents
- Skills you orchestrate with (superpowers / python-development / local / built-in)
- MCP servers available
- Plugins & the full agent inventory

## Skills you orchestrate with

Skills are invoked with the **Skill tool** (not dispatched as agents) and define *how* you work. **Superpowers first** (see `../SKILL.md` → "Toolbox priority").

### superpowers (claude-plugins-official) — process discipline, always first
| Skill | Use when |
|---|---|
| `superpowers:brainstorming` | any creative / new work — explore intent before building |
| `superpowers:writing-plans` | turning a spec into a step-by-step plan |
| `superpowers:executing-plans` | running a written plan in a separate session with checkpoints |
| `superpowers:subagent-driven-development` | executing plan tasks in the current session |
| `superpowers:dispatching-parallel-agents` | 2+ independent tasks, no shared state |
| `superpowers:test-driven-development` | before writing any feature/bugfix code (RED→GREEN→REFACTOR) |
| `superpowers:systematic-debugging` | any bug, test failure, or unexpected behavior |
| `superpowers:requesting-code-review` | completing work / before merge |
| `superpowers:receiving-code-review` | acting on review feedback — verify, don't blindly comply |
| `superpowers:verification-before-completion` | before claiming done / fixed / passing |
| `superpowers:using-git-worktrees` | isolating risky feature work |
| `superpowers:finishing-a-development-branch` | merge / PR / cleanup decision |
| `superpowers:writing-skills`, `superpowers:using-superpowers` | authoring skills / the skill framework itself |

### python-development (claude-code-workflows) — Python house-style reference
Coding-standard reference skills; load the matching one so a Python specialist's output fits house style: `async-python-patterns`, `python-anti-patterns`, `python-background-jobs`, `python-code-style`, `python-configuration`, `python-design-patterns`, `python-error-handling`, `python-observability`, `python-packaging`, `python-performance-optimization`, `python-project-structure`, `python-resilience`, `python-resource-management`, `python-testing-patterns`, `python-type-safety`, `uv-package-manager`.

### Local skills (`~/.claude/skills`)
| Skill | Use for |
|---|---|
| `code-discovery` | the jetbrains → codebase-memory → grep ladder for symbol/reference/call-graph lookup (extracted from this skill) |
| `context7-grounding` | produce the context7 documentation grounding brief before a code-changing dispatch (extracted from this skill) |
| `review-loop` | run the fresh-independent re-review loop on a change until clean (extracted from this skill) |
| `codebase-memory` | knowledge-graph code tools (pairs with the `codebase-memory-mcp` server) |
| `architecture-decision-records` | capture an ADR when a real architectural decision is made |
| `context-budget` | audit what's eating the context window (agents / skills / MCP) |
| `playwright-cli` | drive a browser / run Playwright tests |
| `deep-research` | multi-source, fact-checked research report |
| `manager` | this skill |

### Built-in Claude Code skills/commands
`code-review`, `simplify`, `security-review`, `review`, `verify`, `run`, `init`, `loop`, `schedule`, `update-config`, `keybindings-help`, `fewer-permission-prompts`, `claude-api`. User-triggered harness commands — surface them to the user when relevant; they are not dispatch targets.

## MCP servers available

You (the orchestrator) call these directly — they are not subagents. Prefer them over raw Read/Grep for the jobs below.
The jetbrains → codebase-memory → grep **priority ladder** for code search lives in the **`code-discovery`** skill.

| Server | Scope | Key tools | Use for |
|---|---|---|---|
| `jetbrains` (PyCharm MCP) | user | `search_symbol`, `get_symbol_info`, `search_in_files_by_text`, `search_in_files_by_regex`, `find_files_by_name_keyword`, `rename_refactoring`, `get_file_problems`, `read_file`, `execute_terminal_command` | **live PyCharm IDE index** — prefer over grep/codebase-memory for symbol lookup, go-to-definition, call graph, inspections; `read_file` reads into JARs + decompiles .class; always pass `projectPath` param; requires PyCharm open |
| `codebase-memory-mcp` | global | `index_status`, `index_repository`, `search_graph`, `get_code_snippet`, `trace_path`, `search_code`, `get_architecture`, `query_graph` | indexed code discovery — second choice (async graph); use when jetbrains is unavailable |
| `context7` (context7 plugin) | global | `mcp__plugin_context7_context7__resolve-library-id`, `…__query-docs` | **mandatory grounding** — current library/framework docs **and best practices**; query every touched library twice (API + best practices); your job, not a subagent's (see the `context7-grounding` skill) |
| local Postgres (server name varies) | global | `mcp__<postgres-server>__query` | run SQL against a locally-configured project Postgres for inspection (read-only intent); resolve the exact tool name via ToolSearch |
| `ide` | built-in | `mcp__ide__getDiagnostics` | LSP / type diagnostics for open files |
| `github` | project-scoped | GitHub PR / issue / API tools | GitHub ops — may be dormant if the server isn't connected this session |

## Plugins & the full agent inventory

Three marketplaces, plus local (non-plugin) agents under `~/.claude/agents`. The *Source* column of the dispatch tables is also the dispatch namespace (see `dispatch-table.md` → "Dispatch-name resolution"). **wshobson (`claude-code-workflows`) is the primary agent set since the 2026-06-25 voltagent→wshobson migration; voltagent is kept only for orphan agents.**

| Marketplace (repo) | Installed plugins |
|---|---|
| `claude-plugins-official` (anthropics/claude-plugins-official) | `superpowers` (skills + the using-superpowers framework), `context7` (MCP server) |
| `claude-code-workflows` (wshobson/agents) — **primary** | 83-bundle marketplace (191 agents). Installed bundles: `python-development`, `agent-orchestration`, `backend-development`, `frontend-mobile-development`, `ui-design`, `cloud-infrastructure`, `kubernetes-operations`, `cicd-automation`, `incident-response`, `comprehensive-review`, `data-engineering`, `machine-learning-ops`, `llm-application-dev`, `database-cloud-optimization`. wshobson **duplicates agents across bundles** — dispatch by the installed bundle's name. Install more bundles on demand (see `dispatch-table.md` → "Other stacks"). |
| `voltagent-subagents` (VoltAgent/awesome-claude-code-subagents) — **orphans only** | `voltagent-qa-sec` (kept for `penetration-tester`, `powershell-security-hardening`, `chaos-engineer`, `qa-expert`, `compliance-auditor`, `gdpr-ccpa-compliance`), `voltagent-data-ai` (kept for `postgres-pro`). `voltagent-core-dev` and `voltagent-infra` were **uninstalled**. |

**Local, non-plugin (`~/.claude/agents`):**
- `awesome-claude-agents/` — a cloned agent library (bare names): core (`code-archaeologist`, `code-reviewer`, `documentation-specialist`, `performance-optimizer`), orchestrators (`project-analyst`, `team-configurator`, `tech-lead-orchestrator`), universal (`api-architect`, `backend-developer`, `frontend-developer`, `tailwind-frontend-expert`), and the stack specialists listed in `dispatch-table.md` → "Other stacks".
- `comment-analyzer` — reviews comment accuracy / comment-rot.
- `silent-failure-hunter` — finds swallowed errors, bad fallbacks, missing error propagation.
