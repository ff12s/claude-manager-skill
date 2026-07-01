---
name: context7-grounding
description: Use before any code-changing work that touches a third-party library, framework, API, CLI, cloud service, or an established pattern (transactional outbox, retries/backoff, auth, ORM sessions, async, migrations). Produces a documentation grounding brief from current docs via context7 (API surface + best practices, version-pinned) to thread into writer/fixer/reviewer prompts as args.grounding. The orchestrator produces the brief; a subagent cannot (it does not know the pinned version).
---


# Documentation grounding — context7 first (full procedure)

Invoke this before any code-changing dispatch (the `manager` skill's Grounding gate points here). This is the
orchestrator's job, not a subagent's. Produce the brief, then pass it as `args.grounding`.

Before you dispatch any specialist to write or change code, **you (the orchestrator) produce a grounding brief from current documentation.** Grounding is your job, not a subagent's — subagents don't know which version the repo pins. This step is **required whenever the change touches a third-party library, framework, API, CLI, cloud service, or an established pattern** (transactional outbox, retries/backoff, auth, ORM sessions, async, migrations, etc.) — which is nearly every code change. Skip it only for a self-contained edit that touches no library and no named pattern.

Baseline failure this prevents: looking up *one* library, *late*, for an *API signature only*. "Maximally" means broad, early, and best-practice-inclusive. Produce the brief in four parts, in order:

1. **Enumerate the surface.** From the code you just read — and `requirements*.txt` / `pyproject.toml` for **pinned versions** — list *every* library/framework/API the change will touch, **not only the ones the user named**. (A "504 + double-emit" task touches SQLAlchemy, psycopg, Flask, Celery, and confluent-kafka, not just "the database".)
2. **Query context7 twice per item** — once for the **API surface** you'll rely on, once for **best practices / pitfalls**:
   - `mcp__plugin_context7_context7__resolve-library-id(libraryName=...)` → `…query-docs(context7CompatibleLibraryID=..., topic="<exact API you'll touch>")`
   - then `…query-docs(..., topic="<feature> best practices common pitfalls")`, pinned to the repo's version. Prefer context7 over web search for anything a library owns.
3. **Cross-cutting best practices no single library owns** (architecture, concurrency, security, idempotency patterns) → `WebSearch`, or the `deep-research` skill for anything deep or contested. Capture 1–3 authoritative sources **with version/date**.
4. **Write the brief**: per item, the verified API signature(s), the best-practice rule, and the citation (library id + topic, or URL + date). Bullets, not prose.

Then **thread the brief through the entire loop** — this is what makes the grounding "maximal" rather than decorative:
- Into the **writer's** dispatch prompt verbatim ("Conform to these current-doc-verified APIs and best practices: …").
- Into the **fixer's** prompt on every iteration.
- Into every **reviewer's** prompt ("Verify the change matches these current-doc best practices; flag any deviation as a finding").

Pass it to the Workflow as `args.grounding` (a string). **Re-ground** (repeat parts 1–2 for the new surface) only when a specialist introduces a library or pattern the brief didn't cover; don't re-query what you already grounded.
