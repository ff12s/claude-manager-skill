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
- Agents with no current home (don't dispatch)

Pick the most specific agent for the task. If a stack-specific agent exists, prefer it over a generic one.

**Dispatch-name resolution (read once).** Pass the resolved name as **`agentType`** in a Workflow `agent()` call, alongside `model: 'opus', effort: 'xhigh'` (the opts override the agent's frontmatter model). Resolution by source:

- **wshobson (`claude-code-workflows`) — the primary set.** Name is **`<bundle>:<agent>`**, e.g. `comprehensive-review:code-reviewer`, `backend-development:backend-architect`. wshobson **duplicates the same agent across many bundles** (e.g. `code-reviewer` exists in `comprehensive-review`, `incident-response`, `tdd-workflows`…). Always use the bundle that is **installed** — the bundle named in the tables below. Installed bundles: `python-development`, `agent-orchestration`, `backend-development`, `frontend-mobile-development`, `ui-design`, `cloud-infrastructure`, `kubernetes-operations`, `cicd-automation`, `incident-response`, `comprehensive-review`, `data-engineering`, `machine-learning-ops`, `llm-application-dev`, `database-cloud-optimization`.
- **voltagent — kept only for orphan agents wshobson lacks.** Only two voltagent plugins remain installed: `voltagent-qa-sec` and `voltagent-data-ai`. Use them **only** for the agents explicitly tagged `voltagent-*` below (e.g. `voltagent-data-ai:postgres-pro`, `voltagent-qa-sec:penetration-tester`). `voltagent-core-dev` and `voltagent-infra` are **uninstalled** — never dispatch their old names.
- **awesome-claude-agents / local (`~/.claude/agents`)** — use the **bare name** (`code-archaeologist`, `silent-failure-hunter`, `comment-analyzer`, …).
- **built-in** — bare name (`Explore`, `Plan`, `general-purpose`).

**Tier every dispatch** (`{model, effort}`) by role — see `../SKILL.md` → "Dispatch mechanism": reviewers / `security-auditor` / `architect-review` → `opus` @ `xhigh`; writer / fixer / stack specialists → `sonnet` @ `high` (escalate to `{opus, xhigh}` for cross-file work); recon / `comment-analyzer` → `haiku` (no `effort`). `xhigh` is Opus/Fable only; Haiku rejects `effort`.

**Name collisions.** A **bare** name that exists in both the local awesome-claude-agents library and a plugin resolves to the **local** copy. After the voltagent→wshobson migration the collision set shrank (voltagent-core-dev removed), but `code-reviewer` still exists locally **and** in wshobson — so for the Review Loop always dispatch the namespaced **`comprehensive-review:code-reviewer`**, never bare `code-reviewer`. Same for `security-auditor` → `comprehensive-review:security-auditor`.

### Python & data (the main stack)
| Task | Agent | Source |
|---|---|---|
| Generic Python code, async, typing, packaging | `python-pro` | python-development |
| FastAPI services, routers, dependency injection | `fastapi-pro` | python-development |
| Django models, views, admin | `django-pro` | python-development |
| Data pipelines (ETL/ELT, Airflow, dbt, Spark) | `data-engineer` | data-engineering |
| Exploratory analysis, notebooks, statistics | `data-scientist` | machine-learning-ops |
| ML model training & evaluation | `ml-engineer` | machine-learning-ops |
| ML deployment & monitoring | `mlops-engineer` | machine-learning-ops |
| LLM application architecture | `ai-engineer` | llm-application-dev |
| Prompt design | `prompt-engineer` | llm-application-dev |
| Vector search / RAG storage | `vector-database-engineer` | llm-application-dev |

### Databases
| Task | Agent | Source |
|---|---|---|
| Query plan tuning, index design, slow queries | `database-optimizer` | database-cloud-optimization |
| Schema / data-model design, SQL | `database-architect` | database-cloud-optimization |
| **Postgres-specific work (extensions, replication)** | `postgres-pro` | **voltagent-data-ai** (orphan) |

### Backend / API (non-Python)
| Task | Agent | Source |
|---|---|---|
| Generic backend services / architecture | `backend-architect` | backend-development |
| REST / API design | `backend-architect` | backend-development |
| GraphQL schema | `graphql-architect` | backend-development |
| Microservices decomposition | `backend-architect` | backend-development |
| Event sourcing / CQRS | `event-sourcing-architect` | backend-development |

### Frontend
| Task | Agent | Source |
|---|---|---|
| Generic frontend work | `frontend-developer` | frontend-mobile-development |
| Component / UI design | `ui-designer` | ui-design |
| Design systems | `design-system-architect` | ui-design |
| Mobile (cross-platform) | `mobile-developer` | frontend-mobile-development |

### Infrastructure & DevOps
| Task | Agent | Source |
|---|---|---|
| Cloud architecture (AWS/Azure/GCP/OCI) | `cloud-architect` | cloud-infrastructure |
| Terraform / IaC | `terraform-specialist` | cloud-infrastructure |
| Production deploys | `deployment-engineer` | cloud-infrastructure |
| Network engineering | `network-engineer` | cloud-infrastructure |
| Service mesh | `service-mesh-expert` | cloud-infrastructure |
| Kubernetes manifests, operators, GitOps | `kubernetes-architect` | kubernetes-operations |
| CI/CD pipelines, GitHub Actions/GitLab CI | `deployment-engineer` | cicd-automation |
| Generic DevOps / troubleshooting | `devops-troubleshooter` | cicd-automation |
| Live incident response | `incident-responder` | incident-response |

### Quality, security, debug
| Task | Agent | Source |
|---|---|---|
| Code review (always — used inside the Review Loop) | `code-reviewer` | comprehensive-review |
| Architecture / design critique of a proposed approach | `architect-review` | comprehensive-review |
| Security audit | `security-auditor` | comprehensive-review |
| Silent failures, swallowed errors, bad fallbacks, missing error propagation | `silent-failure-hunter` | local (`~/.claude/agents`) |
| Comment accuracy / comment-rot review | `comment-analyzer` | local (`~/.claude/agents`) |
| Debugging a specific bug | `debugger` | incident-response |
| Tracing intermittent / error-pattern issues | `error-detective` | incident-response |
| Test strategy / test code | `test-automator` | incident-response |
| Performance tuning | `performance-engineer` | backend-development |
| Accessibility / a11y review | `accessibility-expert` | ui-design |
| Library / framework / API behavior or best practices | **don't dispatch — ground it yourself** with `mcp__plugin_context7_context7__resolve-library-id` + `query-docs` (API + best practices), then thread the brief into the dispatch (see `grounding.md`) |
| **Pen testing mindset** | `penetration-tester` | **voltagent-qa-sec** (orphan) |
| **PowerShell-specific hardening** | `powershell-security-hardening` | **voltagent-qa-sec** (orphan) |
| **Chaos / resilience testing** | `chaos-engineer` | **voltagent-qa-sec** (orphan) |
| **QA strategy (broad)** | `qa-expert` | **voltagent-qa-sec** (orphan) |
| **Compliance (GDPR/CCPA/HIPAA general)** | `compliance-auditor`, `gdpr-ccpa-compliance` | **voltagent-qa-sec** (orphan) |

### Cross-cutting
| Task | Agent | Source |
|---|---|---|
| Initial codebase reconnaissance ("what is this repo?") | `code-archaeologist`, `project-analyst` | awesome-claude-agents |
| Broad read-only search across many files (recon, "where is X?") | `Explore` | built-in |
| Design an implementation plan (prefer `superpowers:writing-plans` first) | `Plan` | built-in |
| Open-ended multi-step research / search | `general-purpose` | built-in |
| Documentation (README / API / architecture / onboarding) | `docs-architect`, `reference-builder` | documentation-generation (install on demand) / `documentation-specialist` (awesome-claude-agents) |
| Tech-agnostic REST / contract design | `api-architect` | awesome-claude-agents |
| Long-lived shared context for a multi-stage task | `context-manager` | agent-orchestration |
| Picking the right team for a brand-new project | `team-configurator` | awesome-claude-agents |
| Last-resort orchestrator if you want a second opinion on dispatch | `tech-lead-orchestrator` | awesome-claude-agents (requires launch via `claude --agent`) |

### Other stacks
wshobson ships rich language specialists in **bundles that are NOT installed by default** — install the bundle on demand, then dispatch `<bundle>:<agent>`:

| Stack | Agent | Bundle (install on demand) |
|---|---|---|
| Go / Rust / C / C++ | `golang-pro`, `rust-pro`, `c-pro`, `cpp-pro` | systems-programming |
| JavaScript / TypeScript | `javascript-pro`, `typescript-pro` | javascript-typescript |
| Java / Scala / C# | `java-pro`, `scala-pro`, `csharp-pro` | jvm-languages |
| PHP / Ruby | `php-pro`, `ruby-pro` | web-scripting |
| Elixir / Haskell | `elixir-pro`, `haskell-pro` | functional-programming |
| SQL specialist | `sql-pro` | database-design |
| Bash / POSIX shell | `bash-pro`, `posix-shell-pro` | shell-scripting |

The local awesome-claude-agents library (bare names) also still provides stack specialists rarely needed in this Python/Flask repo: `django-backend-expert`, `django-api-developer`, `django-orm-expert`, `fastapi-expert`, `python-expert`, `react-component-architect`, `react-nextjs-expert`, `vue-component-architect`, `vue-nuxt-expert`, `rails-api-developer`, `rails-activerecord-expert`, `laravel-backend-expert`, `laravel-eloquent-expert`, `tailwind-frontend-expert`, `backend-developer`, `frontend-developer`.

### Agents with no current home (don't dispatch)
These were provided by the now-uninstalled `voltagent-core-dev` / `voltagent-infra` and have **no installed equivalent**. Don't dispatch them; use the nearest substitute or install the matching wshobson bundle.

| Gone agent | Nearest substitute |
|---|---|
| `websocket-engineer` | `backend-architect` (backend-development) |
| `electron-pro` | `frontend-developer` (frontend-mobile-development) |
| `design-bridge` | `design-system-architect` (ui-design) |
| `docker-expert` | `deployment-engineer` (cicd-automation) |
| `database-administrator` | `database-architect` (database-cloud-optimization) |
| `sre-engineer` | install `observability-monitoring` → `observability-engineer` |
| `platform-engineer` | `cloud-architect` (cloud-infrastructure) |
| `azure-infra-engineer` | `cloud-architect` (cloud-infrastructure) |
| `windows-infra-admin` | `cloud-architect` (cloud-infrastructure) + ground PowerShell via context7 |
| `devops-engineer` | `devops-troubleshooter` (cicd-automation) |
