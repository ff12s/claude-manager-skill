# Dispatch table — pick the specialist

Read this when decomposing a task and choosing which specialist to dispatch (see `../SKILL.md` → "Process").

## Contents
- Dispatch-name resolution & collisions
- Python & data
- Databases
- Backend / API (non-Python)
- Frontend
- Infrastructure & DevOps
- Quality, security, debug
- Cross-cutting
- Other stacks

Pick the most specific agent for the task. If a stack-specific agent exists, prefer it over a generic one.

**Dispatch-name resolution (read once):** for an agent whose *Source* is a **plugin** (`python-development`, `voltagent-*`, `agent-orchestration`), the resolved name is **`<Source>:<Agent>`** — e.g. `python-development:python-pro`, `voltagent-qa-sec:code-reviewer`, `agent-orchestration:context-manager`. For an agent whose *Source* is `awesome-claude-agents` or `local` (the two standalone files), use the **bare name**. A bare name that collides resolves to the **local awesome-claude-agents** copy — namespace it to force the voltagent variant (see `../SKILL.md` → Rules → Name collisions). Pass this resolved name as **`agentType`** in a Workflow `agent()` call, alongside `model: 'opus', effort: 'xhigh'` (the opts override the agent's frontmatter model).

### Python & data (the main stack)
| Task | Agent | Source |
|---|---|---|
| Generic Python code, async, typing, packaging | `python-pro` | python-development |
| FastAPI services, routers, dependency injection | `fastapi-pro` | python-development |
| Django models, views, admin | `django-pro` | python-development |
| Data pipelines (ETL/ELT, Airflow, dbt, Spark) | `data-engineer` | voltagent-data-ai |
| Exploratory analysis, notebooks, statistics | `data-analyst` or `data-scientist` | voltagent-data-ai |
| ML model training & evaluation | `machine-learning-engineer` or `ml-engineer` | voltagent-data-ai |
| ML deployment & monitoring | `mlops-engineer` | voltagent-data-ai |
| LLM application architecture | `llm-architect` or `ai-engineer` | voltagent-data-ai |
| Prompt design | `prompt-engineer` | voltagent-data-ai |

### Databases
| Task | Agent | Source |
|---|---|---|
| Query plan tuning, index design, slow queries | `database-optimizer` | voltagent-data-ai |
| Postgres-specific work (extensions, replication) | `postgres-pro` | voltagent-data-ai |
| DBA tasks (backup, migration ops, users) | `database-administrator` | voltagent-infra |

### Backend / API (non-Python)
| Task | Agent | Source |
|---|---|---|
| Generic backend services | `backend-developer` | voltagent-core-dev |
| REST API design | `api-designer` | voltagent-core-dev |
| GraphQL schema | `graphql-architect` | voltagent-core-dev |
| Microservices decomposition | `microservices-architect` | voltagent-core-dev |
| WebSocket / realtime | `websocket-engineer` | voltagent-core-dev |

### Frontend
| Task | Agent | Source |
|---|---|---|
| Generic frontend work | `frontend-developer` | voltagent-core-dev |
| Component / UI design | `ui-designer`, `design-bridge` | voltagent-core-dev |
| Mobile (cross-platform) | `mobile-developer` | voltagent-core-dev |
| Desktop (Electron) | `electron-pro` | voltagent-core-dev |

### Infrastructure & DevOps
| Task | Agent | Source |
|---|---|---|
| Generic DevOps (CI/CD, scripts, automation) | `devops-engineer` | voltagent-infra |
| Container builds, Dockerfile | `docker-expert` | voltagent-infra |
| Kubernetes manifests, operators | `kubernetes-specialist` | voltagent-infra |
| Terraform / IaC | `terraform-engineer` (or `terragrunt-expert`) | voltagent-infra |
| Cloud architecture (AWS/Azure/GCP) | `cloud-architect` | voltagent-infra |
| Azure-specific infra | `azure-infra-engineer` | voltagent-infra |
| Windows server / AD / domain stuff | `windows-infra-admin` | voltagent-infra |
| Production deploys | `deployment-engineer` | voltagent-infra |
| SRE / reliability work | `sre-engineer` | voltagent-infra |
| Live incident response | `incident-responder` or `devops-incident-responder` | voltagent-infra |
| Network engineering | `network-engineer` | voltagent-infra |
| Platform engineering | `platform-engineer` | voltagent-infra |

### Quality, security, debug
| Task | Agent | Source |
|---|---|---|
| Code review (always — used inside the Review Loop) | `code-reviewer` | voltagent-qa-sec |
| Silent failures, swallowed errors, bad fallbacks, missing error propagation | `silent-failure-hunter` | local (`~/.claude/agents`) |
| Comment accuracy / comment-rot review | `comment-analyzer` | local (`~/.claude/agents`) |
| Security audit | `security-auditor` | voltagent-qa-sec |
| Pen testing mindset | `penetration-tester` | voltagent-qa-sec |
| PowerShell-specific hardening | `powershell-security-hardening` | voltagent-qa-sec |
| Architecture / design critique of a proposed approach | `architect-reviewer` | voltagent-qa-sec |
| Library / framework / API behavior or best practices | **don't dispatch — ground it yourself** with `mcp__plugin_context7_context7__resolve-library-id` + `query-docs` (API + best practices), then thread the brief into the dispatch (see `grounding.md`) |
| Test strategy / test code | `test-automator`, `qa-expert` | voltagent-qa-sec |
| Accessibility / a11y review | `accessibility-tester` | voltagent-qa-sec |
| Debugging a specific bug | `debugger` | voltagent-qa-sec |
| Tracing intermittent / error-pattern issues | `error-detective` | voltagent-qa-sec |
| Performance tuning | `performance-engineer` | voltagent-qa-sec |
| Compliance (GDPR/CCPA/HIPAA general) | `compliance-auditor`, `gdpr-ccpa-compliance` | voltagent-qa-sec |
| Chaos / resilience testing | `chaos-engineer` | voltagent-qa-sec |

### Cross-cutting
| Task | Agent | Source |
|---|---|---|
| Initial codebase reconnaissance ("what is this repo?") | `code-archaeologist`, `project-analyst` | awesome-claude-agents |
| Broad read-only search across many files (recon, "where is X?") | `Explore` | built-in |
| Design an implementation plan (prefer `superpowers:writing-plans` first) | `Plan` | built-in |
| Open-ended multi-step research / search | `general-purpose` | built-in |
| Documentation (README / API / architecture / onboarding) | `documentation-specialist` | awesome-claude-agents |
| Tech-agnostic REST / contract design | `api-architect` | awesome-claude-agents |
| Long-lived shared context for a multi-stage task | `context-manager` | agent-orchestration |
| Picking the right team for a brand-new project | `team-configurator` | awesome-claude-agents |
| Last-resort orchestrator if you want a second opinion on dispatch | `tech-lead-orchestrator` | awesome-claude-agents (requires launch via `claude --agent`) |

### Other stacks (awesome-claude-agents — bare names, rarely needed in this Python/Flask repo)
| Stack | Agents |
|---|---|
| Django (alt to `python-development:django-pro`) | `django-backend-expert`, `django-api-developer`, `django-orm-expert`, `django-expert` |
| FastAPI (alt to `python-development:fastapi-pro`) | `fastapi-expert` |
| Generic Python (alt to `python-development:python-pro`) | `python-expert` |
| Python testing / security / perf / scraping / devops / ML | `Python Testing Expert`, `Python Security Expert`, `Python Performance Expert`, `Python Web Scraping Expert`, `Python DevOps/CI-CD Expert`, `ml-data-expert` |
| React / Next.js | `react-component-architect`, `react-nextjs-expert` |
| Vue / Nuxt | `vue-component-architect`, `vue-nuxt-expert` |
| Rails | `rails-api-developer`, `rails-activerecord-expert` |
| Laravel | `laravel-backend-expert`, `laravel-eloquent-expert` |
| Tailwind CSS / utility-first styling | `tailwind-frontend-expert` |
| Generic backend/frontend (alt to voltagent) | `backend-developer`, `frontend-developer` |
