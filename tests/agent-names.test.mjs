// Agent name correctness tests for the /manager skill.
//
// The wshobson "comprehensive-review" bundle registers agents with the bundle prefix repeated
// in the agent name: comprehensive-review:comprehensive-review-code-reviewer (NOT :code-reviewer).
// These tests are the RED guard that caught that bug and must stay green to prevent regression.
//
// Also verifies that the test-runner agent (TESTER) is documented with the correct full name.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const skillDir = join(here, '..', 'skills', 'manager');
const md = readFileSync(join(here, '..', 'skills', 'review-loop', 'review-loop.md'), 'utf8');
const dispatchTable = readFileSync(join(skillDir, 'references', 'dispatch-table.md'), 'utf8');
const body = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');

const m = md.match(/```js\r?\n([\s\S]*?)\r?\n```/);
assert.ok(m, 'review-loop.md must contain a ```js fenced Workflow script');
const SRC = m[1];

// ─── Workflow script template — the constants that the orchestrator fills in ───

test('REVIEWER constant in script uses comprehensive-review:comprehensive-review-code-reviewer', () => {
  assert.match(SRC, /const REVIEWER\s*=\s*'comprehensive-review:comprehensive-review-code-reviewer'/);
});

test('script template has TESTER constant (for the parallel test-runner)', () => {
  assert.match(SRC, /const TESTER\s*=/);
});

test('script template has TESTER_POWER constant', () => {
  assert.match(SRC, /const TESTER_POWER\s*=/);
});

// ─── SKILL.md Review Loop section uses the full registered names ───

test('SKILL.md Review Loop section uses comprehensive-review:comprehensive-review-code-reviewer', () => {
  assert.match(body, /comprehensive-review:comprehensive-review-code-reviewer/,
    'SKILL.md must use the full registered agentType, not the short comprehensive-review:code-reviewer');
});

test('SKILL.md Review Loop section uses comprehensive-review:comprehensive-review-security-auditor', () => {
  assert.match(body, /comprehensive-review:comprehensive-review-security-auditor/,
    'SKILL.md must use the full registered agentType, not the short comprehensive-review:security-auditor');
});

test('SKILL.md has no bare backtick-quoted comprehensive-review:code-reviewer (short/unregistered form)', () => {
  // The short form `comprehensive-review:code-reviewer` (without the extra comprehensive-review- prefix)
  // does NOT exist as a registered agent and causes "agent type not found" at runtime.
  // Note: the long form comprehensive-review:comprehensive-review-code-reviewer contains "code-reviewer"
  // as a suffix, so we look for the exact short-form token (ends before the next hyphen).
  assert.doesNotMatch(body, /`comprehensive-review:code-reviewer`/,
    'short form comprehensive-review:code-reviewer is not registered — use the full name');
});

test('SKILL.md has no bare backtick-quoted comprehensive-review:security-auditor (short/unregistered form)', () => {
  assert.doesNotMatch(body, /`comprehensive-review:security-auditor`/,
    'short form comprehensive-review:security-auditor is not registered — use the full name');
});

test('SKILL.md documents when to set TESTER (repos with a test suite)', () => {
  // The Review Loop section must tell the orchestrator when TESTER should be non-empty.
  assert.match(body, /TESTER/,
    'SKILL.md must mention the TESTER constant');
  assert.match(body, /test suite|runnable test/i,
    'SKILL.md must describe when TESTER should be set (for repos with a runnable test suite)');
});

// ─── review-loop.md uses the full names in prose and tier table ───

test('review-loop.md uses comprehensive-review:comprehensive-review-security-auditor in tier table', () => {
  assert.match(md, /comprehensive-review:comprehensive-review-security-auditor/,
    'review-loop.md tier table must use the full registered name, not the short :security-auditor');
});

test('review-loop.md has no bare backtick-quoted comprehensive-review:security-auditor', () => {
  assert.doesNotMatch(md, /`comprehensive-review:security-auditor`/);
});

// ─── dispatch-table.md Quality section — agent column uses names that produce correct agentType ───
// Resolution rule: agentType = <bundle>:<agent>.
// For comprehensive-review the agent name itself contains the bundle prefix (e.g. comprehensive-review-code-reviewer),
// so the table must list the repeated-prefix form so that <bundle>:<agent> constructs the correct full name.

test('dispatch-table.md Quality section uses comprehensive-review-code-reviewer as agent name', () => {
  assert.match(dispatchTable, /comprehensive-review-code-reviewer/,
    'dispatch-table must use comprehensive-review-code-reviewer so the agentType resolves correctly');
});

test('dispatch-table.md Quality section uses comprehensive-review-security-auditor as agent name', () => {
  assert.match(dispatchTable, /comprehensive-review-security-auditor/);
});

test('dispatch-table.md Quality section uses comprehensive-review-architect-review as agent name', () => {
  assert.match(dispatchTable, /comprehensive-review-architect-review/);
});

test('dispatch-table.md collision note uses comprehensive-review:comprehensive-review-code-reviewer (full name)', () => {
  // The collision note must instruct to dispatch the FULL name so the orchestrator copies it correctly.
  assert.match(dispatchTable, /comprehensive-review:comprehensive-review-code-reviewer/);
});

test('dispatch-table.md collision note uses comprehensive-review:comprehensive-review-security-auditor (full name)', () => {
  assert.match(dispatchTable, /comprehensive-review:comprehensive-review-security-auditor/);
});

test('dispatch-table.md Quality section lists the test-runner agent backend-development:backend-development-test-automator', () => {
  assert.match(dispatchTable, /backend-development:backend-development-test-automator/,
    'dispatch-table must document which agent to use as TESTER for Python/backend projects');
});

test('SKILL.md names the recommended test-runner agentType (backend-development:backend-development-test-automator)', () => {
  // Without the specific agentType, the orchestrator leaves TESTER='' and the test runner never fires.
  assert.match(body, /backend-development:backend-development-test-automator/,
    'SKILL.md must tell the orchestrator which agentType to use for TESTER');
});
