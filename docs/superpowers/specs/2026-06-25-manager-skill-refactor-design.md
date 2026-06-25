# Manager skill refactor — design

**Date:** 2026-06-25
**Repo:** `claude-manager-skill` (skill source: `skills/manager/`)
**Driver:** research artifact «Рефакторинг и упрощение skill "manager"» (June 2026 SKILL.md standard),
saved at `1642_20_status/.claude/docs/compass_artifact_wf-9e8b0717-...md`.

## Goal

Shrink the `manager` SKILL.md body from ~540 lines / 47 KB to a focused **<500-line** body by applying
**progressive disclosure**, eliminate the **dual Review-Loop description** and the **dual output protocol**,
and keep one source of truth — **without changing the skill's behavior or orchestration power**.

## Scope (agreed)

**In:** Stage 1 (decomposition) + the protocol-unification part of Stage 2 from the research doc.
- Move static/reference content out of the body into `references/`, read on demand.
- Move the canonical Workflow Review-Loop script out of the body into a reference file.
- Collapse the Review-Loop prose into a compact **semantic contract** in the body.
- Kill the text output protocol (`[SEVERITY] ::: … / NO_FINDINGS`); keep only JSON `findings[]`.
- Light pass rewriting the harshest CAPS `MUST/NEVER` into "rule + why".

**Out (deferred):** plugin packaging (`.claude-plugin/plugin.json`), changing frontmatter `model`/`effort`,
the full eval harness (`evals.json` + grader subagents).

## Assessment that shaped the scope

The research doc is accurate to the June-2026 SKILL.md standard, but two of its generic recommendations had to
be adapted to this skill's reality:

1. **"Move the Review Loop into `scripts/` that Claude *runs*, code not loaded into context" — wrong mechanism
   for us.** Our Review Loop is a **Workflow-DSL script** (uses `agent()`/`parallel()`/`phase()`), executed only
   inside the Workflow-tool runtime, not via Bash/Python. It is a **template the orchestrator adapts** per
   dispatch (fills `args`, sometimes adds phases/reviewers) — "medium freedom", not "run exactly this". Because
   the orchestrator must read and adapt it, the doc's "code not loaded into context" token saving does not hold.
   A fixed committed `scripts/review_loop.js` reused via a constant `scriptPath` is also the known
   stale-cache footgun (Workflow CWD/caching gotcha).
   → **Decision:** keep one canonical Workflow script, but as a `references/` file (read + adapt on demand),
   not a `scripts/` file claimed to never load.

2. **"Subagent structured output is not platform-guaranteed (issue #20625)" — does not apply to us.** We dispatch
   via Workflow `agent(…, {schema})`, which enforces the JSON schema at the tool-call layer (StructuredOutput).
   Our `findings[]` contract is therefore solid — extra reason to delete the legacy text protocol.

Where the doc applies cleanly: progressive disclosure / <500-line body, the dual Review-Loop + dual-protocol
cruft, CAPS→"rule+why", pushy third-person `description`.

## Working model — junction (single source of truth)

The skill must live in two places: the live `~/.claude/skills/manager/` (what Claude Code loads) and the git
repo copy. To remove drift, the live directory becomes a **directory junction** into the repo.

One-time setup:
1. Confirm repo `skills/manager/SKILL.md` is byte-identical to the live one (it is — already committed).
2. Remove `C:\Users\ff128\.claude\skills\manager\`.
3. `New-Item -ItemType Junction -Path C:\Users\ff128\.claude\skills\manager -Target C:\Users\ff128\claude-manager-skill\skills\manager` (junctions need no admin on Windows).

After this: edit in the repo, Claude Code sees changes through the junction, commit from the repo. Update the
memory note (`project-manager-skill-repo`) from "copy / manual sync / drift risk" to "junction, single source".

## Target structure

```
skills/manager/
├── SKILL.md                 # ~150 lines (behavioral content only)
└── references/
    ├── review-loop.md       # canonical Workflow script + FINDINGS/SNAP schema
    │                        #   + detailed iteration steps + how to adapt/run
    ├── dispatch-table.md    # full dispatch table + name resolution + collisions + "other stacks"
    ├── toolbox.md           # skills inventory + MCP servers + plugins/agents inventory
    └── grounding.md         # detailed 4-part context7 grounding procedure
```

**Body (`SKILL.md`) keeps:** frontmatter + intro (orchestrator, not implementer); toolbox-priority principle
(superpowers first); a compact grounding **gate**; the dispatch mechanism summary (Workflow at opus/xhigh);
the **Process** steps; a compact Review-Loop **semantic contract** (guard-intent table + escalation rule +
per-iteration state summary + "always review / never one-pass"); **Rules**; and a **navigation table** pointing
into `references/`.

**Moved to `references/`:** the ~125-line Workflow JS, the full dispatch table (~104 lines), the skills/MCP/
plugins inventories (~60 lines), the detailed grounding procedure. Each reference file >100 lines gets a TOC.

Granularity note: the findings JSON schema lives inside `review-loop.md` (it is needed exactly there), not as a
separate `findings-schema.md`.

## Protocol unification

- Remove the text protocol everywhere: the "REQUIRED prompt template" block, fingerprint-from-text-line
  computation, the text-token health check, and `ACCEPT-AS-IS:` text lines.
- Keep only JSON `findings[]`. Fingerprint = `file|line|first8` tuple from the schema. Health check = "mandatory
  reviewer returned `null` → STOP" (PRE-GUARD 0), as the Workflow script already implements.
- The body's semantic contract describes guards in terms of structured findings, not text lines.

## Preserved (no behavior change)

Orchestrator-worker model; `opus`/`xhigh` pinning in Workflow calls (frontmatter model untouched); the 5 working
guards (+ PRE-GUARD 0) — logic unchanged, relocated; context7 grounding; read-only review subagents; the
per-branch / 30-global dispatch budget.

## Verification (lightweight)

- Junction resolves; Claude Code loads the skill from the repo through it.
- `SKILL.md` < 500 lines.
- No orphan mentions of the text protocol (`NO_FINDINGS`, `:::`, `ACCEPT-AS-IS`) remain (grep).
- The Workflow JS in `references/review-loop.md` is logic-identical to the previously inline script (diff-check).
- A couple of trigger sanity prompts confirm dispatch and the Review Loop still fire.

## Acceptance criteria

1. Body < 500 lines, behavioral content only; reference content moved and navigable.
2. Exactly one Review-Loop form (Workflow script in `references/review-loop.md`) + compact body contract.
3. Exactly one output protocol (JSON `findings[]`); no text-protocol residue.
4. Live skill served via junction from the repo; drift impossible.
5. All five guards + PRE-GUARD 0, opus/xhigh pinning, and grounding preserved.
6. Spec committed to this repo; memory note updated to "junction, single source".
