---
name: feature-development-with-tests-and-docs
description: Workflow command scaffold for feature-development-with-tests-and-docs in claude-manager-skill.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-development-with-tests-and-docs

Use this workflow when working on **feature-development-with-tests-and-docs** in `claude-manager-skill`.

## Goal

Implements a new feature or major refactor, including updating documentation and adding or updating tests.

## Common Files

- `docs/*.md`
- `README.md`
- `skills/*/SKILL.md`
- `skills/*/*.md`
- `hooks/*`
- `tests/*.test.mjs`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update documentation/spec in docs/ or README.md
- Add or modify SKILL.md and related files in skills/<skill-name>/
- Add or update implementation files (e.g., hooks/)
- Add or update relevant tests in tests/
- Update references or supporting markdown files as needed

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.