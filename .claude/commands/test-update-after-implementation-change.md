---
name: test-update-after-implementation-change
description: Workflow command scaffold for test-update-after-implementation-change in claude-manager-skill.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /test-update-after-implementation-change

Use this workflow when working on **test-update-after-implementation-change** in `claude-manager-skill`.

## Goal

Updates or tightens tests in response to implementation or review feedback.

## Common Files

- `hooks/*`
- `tests/*.test.mjs`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Modify implementation or hook file
- Update or tighten corresponding test(s) in tests/

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.