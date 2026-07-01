# Design: split `/manager` into skills + JetBrains code-discovery skill + startup probe hook

Date: 2026-07-01
Repo: `claude-manager-skill` (already a skills-monorepo: `skills/manager/`, `package.json`, `tests/`).
Live install: `~/.claude/skills/<name>` are directory **junctions** into `skills/<name>` (single source, no drift).

## Goal

Split the monolithic `manager` skill into the orchestrator plus three autonomous, reusable skills it
invokes, and add a SessionStart hook that probes JetBrains MCP reachability so code-discovery knows
whether to lead with the IDE or fall back.

## Scope decisions (locked with user)

- Three extracted skills: **`code-discovery`**, **`context7-grounding`**, **`review-loop`**.
- `code-discovery` name is **broad** → auto-activates on any symbol/reference/call-graph task, session-wide.
- Hook = **SessionStart port-probe** of JetBrains MCP; injects availability + authoritative ladder.
- Hook install: **we edit `~/.claude/settings.json`** (via `update-config`) and version a copy of the
  script in the repo.
- Junctions: user asked for "full restructure", but discovery shows `manager` **already** lives at
  `skills/manager/` with a correct junction. So the real move is **3 new skill dirs + 3 new junctions;
  the `manager` junction is left untouched** (recreating it is needless churn). — confirm at spec review.

## Target layout

```
claude-manager-skill/
  skills/
    manager/              SKILL.md + references/{dispatch-table,tiers,toolbox}.md   (orchestrator)
    code-discovery/       SKILL.md                (jetbrains → codebase-memory → grep ladder)
    context7-grounding/   SKILL.md                (was skills/manager/references/grounding.md)
    review-loop/          SKILL.md + review-loop.md   (self-contained Workflow script + power() + schemas)
  hooks/
    jetbrains-mcp-probe   (bash; versioned copy of the installed ~/.claude/hooks script)
    settings-snippet.md   (the SessionStart JSON block, for reproducibility)
  tests/                  (updated; see "Test plan")
  docs/specs/2026-07-01-manager-skill-split-design.md
```

Junctions after: `~/.claude/skills/{manager(existing),code-discovery,context7-grounding,review-loop}`.

## The three extracted skills

### `code-discovery`
- Content: the jetbrains-first ladder (from `manager/SKILL.md` Process step 2) + the tool cheatsheets
  for jetbrains / codebase-memory / ide (from `manager/references/toolbox.md` MCP rows).
- Ladder (authoritative, matches the probe hook): **jetbrains MCP → codebase-memory-mcp → raw Grep/Read/Glob**.
- Frontmatter `description`: broad — triggers on "find symbol / definition / references / call graph /
  search code structure" in any session.
- Reconciles with the pre-existing `cbm-session-reminder` hook (which says "codebase-memory FIRST"):
  the code-discovery skill + probe state the jetbrains-first order explicitly; we do **not** overwrite
  the cbm-installed hook (the MCP rewrites it), we layer on top.

### `context7-grounding`
- Content: `manager/references/grounding.md` promoted verbatim to a skill.
- `description`: "produce a context7 documentation grounding brief before code-changing work".
- Manager invokes it at the grounding gate; usable standalone.

### `review-loop`
- Content: `manager/references/review-loop.md` promoted. **Self-contained**: embeds the Workflow script,
  the `power()` compatibility resolver, tier defaults, and the JSON schemas so it runs standalone
  ("run a review loop on this diff"). Manager passes tier/reviewer config as args.
- `description`: "run a fresh-independent re-review loop on a code change until clean (cap 10)".

## Manager after the split (stays the orchestrator)

- `SKILL.md`: Process step 2 → "invoke **code-discovery**"; grounding gate → "invoke
  **context7-grounding**"; Review Loop section → "invoke **review-loop**". Reference table updated to
  point at the sibling skills. Keeps: process, dispatch mechanism, tiers, dispatch-table, trimmed toolbox,
  Workflow dispatch hygiene, Rules.
- `references/`: `dispatch-table.md` and a new `tiers.md` (or keep tiers inline) stay; `toolbox.md`
  trimmed of the rows that moved to `code-discovery` (keep a one-line pointer).

## SessionStart hook — `jetbrains-mcp-probe`

- Language: **bash** (matches existing `cbm-*` hooks; runs under Git Bash on Windows).
- Event: `SessionStart` matchers `startup|resume|clear|compact` (mirrors `cbm-session-reminder`).
- Behavior: TCP-probe `127.0.0.1:64342`; if closed, scan a small range `64342..64345` for the
  port-change gotcha. JetBrains built-in MCP server exposes SSE at `http://localhost:64342/sse`.
  - Reachable → emit: `JetBrains MCP up on port <N>. Code-discovery ladder: jetbrains → codebase-memory → grep.`
  - Not reachable → emit: `JetBrains MCP down. Code-discovery ladder: codebase-memory → grep.`
- Idempotent, fast (no long timeouts), never exits non-zero (SessionStart output is advisory context).
- Install: copy to `~/.claude/hooks/jetbrains-mcp-probe`, `chmod +x`; add SessionStart entry to
  `~/.claude/settings.json` alongside the existing `cbm-session-reminder` block. Versioned copy +
  `settings-snippet.md` committed to the repo.

## Test plan (TDD — repoint RED, then move content GREEN)

Existing tests are path-coupled to `skills/manager/`; extraction breaks them unless updated first.

1. **`jetbrains-mcp.test.mjs`** → repoint from `skills/manager/` to **`skills/code-discovery/SKILL.md`**;
   assert the jetbrains-first ladder, fallback chain, and "never grep for symbols" rule live there.
   Relax manager-side assertions to only check that manager **points to** `code-discovery`.
2. **`review-loop-*.test.mjs`** (contract/guards/tiers) → repoint from
   `skills/manager/references/review-loop.md` to **`skills/review-loop/review-loop.md`**.
3. **New `jetbrains-mcp-probe.test.mjs`** → exec the hook against a fake open port (up case) and a
   guaranteed-closed port (down case); assert the emitted ladder line and zero exit code.
4. **`skill-consistency.test.mjs`** → add: every `skills/*/SKILL.md` has valid frontmatter
   (`name`, `description`); manager references all three sub-skills; keep the existing hygiene checks.
5. `npm test` green before any commit.

## Rollout / execution order

1. Branch in `claude-manager-skill`.
2. Update/repoint tests (RED).
3. Create the three skill dirs + move content; trim manager; write the probe hook + snippet (GREEN).
4. `npm test` green.
5. Create 3 junctions (`mklink /J`); install hook to `~/.claude/hooks`; edit `~/.claude/settings.json`
   (via `update-config`).
6. Verify: new skills load, probe fires on a fresh session, manager still orchestrates.
7. Commit (single-line English message, no Co-Authored-By, per repo convention).

## Risks / notes

- Two SessionStart hooks now advise on code discovery (`cbm-session-reminder` = CBM-first vs probe =
  jetbrains-first). Mitigation: probe + `code-discovery` skill state the authoritative jetbrains-first
  order; cbm hook left as-is (owned by the MCP). Acceptable minor redundancy.
- Broad `code-discovery` description may over-trigger. Acceptable per user (jetbrains-first everywhere);
  can narrow later if noisy.
- Junction creation on Windows needs the correct target paths; `manager` junction is deliberately not
  recreated.
```
