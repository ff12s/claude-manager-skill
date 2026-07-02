// Tests for the TESTER (parallel test-runner) dispatch in the Review Loop.
//
// When TESTER is set to an agentType string, the test-runner fires in parallel with
// the code-reviewer and supplementary reviewers each round. It receives TEST_PROMPT
// (not REVIEW_PROMPT), runs the project's test suite, and returns failures as critical findings.
// TESTER='' (the default) skips the test runner entirely.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const skillDir = join(here, '..', 'skills', 'manager');
const md = readFileSync(join(here, '..', 'skills', 'review-loop', 'review-loop.md'), 'utf8');

const m = md.match(/```js\r?\n([\s\S]*?)\r?\n```/);
assert.ok(m, 'review-loop.md must contain a ```js fenced Workflow script');
const RAW_SRC = m[1].replace(/^export\s+const\s+meta/m, 'const meta');

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const phase = () => {};
const parallel = async (thunks) => Promise.all(thunks.map((t) => t()));
const snap = (size) => ({ snapshot: [{ path: 'a.py', size, head: 'h', tail: 't' }] });

/** Inject TESTER agentType into the script constants (same pattern as makeSrc in tiers test). */
function withTester(testerType) {
  return RAW_SRC.replace(
    /const TESTER\s*=\s*''[^\n]*/,
    `const TESTER = '${testerType}'`,
  );
}

/**
 * Run the script, returning every agent() call's opts object.
 * The mock agent always returns a clean review and the writer's snapshot.
 */
async function runCapturingCalls(src) {
  const calls = [];
  const agent = async (_prompt, opts) => {
    calls.push({ prompt: _prompt, ...opts });
    if (opts.phase === 'Write') return snap(10);
    return { findings: [] }; // clean on first review → EXIT-READY
  };
  const run = new AsyncFunction('agent', 'parallel', 'phase', src);
  const result = await run(agent, parallel, phase);
  return { calls, result };
}

// ─── TESTER disabled (default '') ───

test('TESTER empty string: no test-runner call is made', async () => {
  const { calls } = await runCapturingCalls(RAW_SRC);
  const testerCalls = calls.filter((c) => c.label === 'review:test-runner');
  assert.equal(testerCalls.length, 0, 'test-runner must not fire when TESTER is empty string');
});

// ─── TESTER set to an agentType ───

const TESTER_TYPE = 'backend-development:backend-development-test-automator';

test('TESTER set: test-runner fires in parallel with code-reviewer on iteration 1', async () => {
  const { calls } = await runCapturingCalls(withTester(TESTER_TYPE));
  const reviewCalls = calls.filter((c) => c.phase === 'Review');
  const testerCall = reviewCalls.find((c) => c.label === 'review:test-runner');
  assert.ok(testerCall, `test-runner must fire in Review phase; Review calls: ${JSON.stringify(reviewCalls.map(c => c.label))}`);
});

test('TESTER set: test-runner agentType matches the configured TESTER constant', async () => {
  const { calls } = await runCapturingCalls(withTester(TESTER_TYPE));
  const testerCall = calls.find((c) => c.label === 'review:test-runner');
  assert.ok(testerCall, 'test-runner call not found');
  assert.equal(testerCall.agentType, TESTER_TYPE);
});

test('TESTER set: test-runner uses TEST_PROMPT (contains "test suite"), not REVIEW_PROMPT', async () => {
  const { calls } = await runCapturingCalls(withTester(TESTER_TYPE));
  const testerCall = calls.find((c) => c.label === 'review:test-runner');
  assert.ok(testerCall, 'test-runner call not found');
  // TEST_PROMPT instructs to run the test suite; REVIEW_PROMPT instructs to review the change.
  assert.match(testerCall.prompt, /test suite/i,
    'test-runner must receive TEST_PROMPT (contains "test suite"), not the review-change REVIEW_PROMPT');
  assert.doesNotMatch(testerCall.prompt, /Review the change for the task/,
    'test-runner must not receive the reviewer REVIEW_PROMPT');
});

test('TESTER set: TEST_PROMPT explicitly requires running integration tests, not unit-only', async () => {
  const { calls } = await runCapturingCalls(withTester(TESTER_TYPE));
  const testerCall = calls.find((c) => c.label === 'review:test-runner');
  assert.ok(testerCall, 'test-runner call not found');
  assert.match(
    testerCall.prompt,
    /integration/i,
    'TEST_PROMPT must explicitly mention integration tests so the agent does not silently run only unit tests',
  );
});

test('TESTER set: TEST_PROMPT instructs not to limit run to unit tests only', async () => {
  const { calls } = await runCapturingCalls(withTester(TESTER_TYPE));
  const testerCall = calls.find((c) => c.label === 'review:test-runner');
  assert.ok(testerCall, 'test-runner call not found');
  assert.match(
    testerCall.prompt,
    /do not.{0,30}unit/i,
    'TEST_PROMPT must explicitly forbid limiting the run to unit tests only',
  );
});

test('TESTER set: test-runner dispatched on sonnet @ high (TESTER_POWER default tier)', async () => {
  const { calls } = await runCapturingCalls(withTester(TESTER_TYPE));
  const testerCall = calls.find((c) => c.label === 'review:test-runner');
  assert.ok(testerCall, 'test-runner call not found');
  assert.equal(testerCall.model, 'sonnet');
  assert.equal(testerCall.effort, 'high');
});

test('TESTER set: test-runner null result is non-fatal (loop exits ready, supplementaryUnavailable recorded)', async () => {
  // If the test runner returns null, the loop must not PRE-GUARD-0 stop; it is supplementary, not mandatory.
  const calls = [];
  let reviewRound = 0;
  const agent = async (_prompt, opts) => {
    calls.push(opts);
    if (opts.phase === 'Write') return snap(10);
    if (opts.phase === 'Review') {
      if (opts.label === 'review:test-runner') return null; // simulate unavailable
      reviewRound++;
      return { findings: [] }; // mandatory reviewer is clean
    }
    return { findings: [] };
  };
  const run = new AsyncFunction('agent', 'parallel', 'phase', withTester(TESTER_TYPE));
  const result = await run(agent, parallel, phase);
  assert.equal(result.stoppedBy, null, 'null test-runner must not trigger PRE-GUARD-0 (it is supplementary)');
  assert.ok(
    result.supplementaryUnavailable?.some((u) => u.unavailable.includes('test-runner')),
    'null test-runner must be recorded in supplementaryUnavailable',
  );
});

// ─── Baseline run (pre-existing test failures must not force a false HARD CAP) ───

const failing = (name) => ({ severity: 'critical', file: `${name}.py`, line: 5, first8: `${name} failed`, explanation: `${name} failed: assert` });

test('baseline: with TESTER set, the tester runs once BEFORE the writer', async () => {
  const seq = [];
  const agent = async (_prompt, opts) => {
    seq.push(opts.phase);
    if (opts.phase === 'Baseline') return { findings: [] };
    if (opts.phase === 'Write') return snap(10);
    return { findings: [] };
  };
  const run = new AsyncFunction('agent', 'parallel', 'phase', withTester(TESTER_TYPE));
  await run(agent, parallel, phase);
  assert.equal(seq[0], 'Baseline', 'first dispatch must be the baseline tester');
  assert.ok(seq.indexOf('Baseline') < seq.indexOf('Write'), 'baseline must run before the writer');
});

test('baseline: no baseline dispatch when TESTER is empty', async () => {
  const { calls } = await runCapturingCalls(RAW_SRC);
  assert.equal(calls.filter((c) => c.phase === 'Baseline').length, 0, 'no baseline when TESTER is unset');
});

test('baseline: a pre-existing failing test does NOT block the gate (EXIT-READY despite a red test)', async () => {
  const t = failing('test_legacy');
  const agent = async (_prompt, opts) => {
    if (opts.phase === 'Baseline') return { findings: [t] };            // already red before the change
    if (opts.phase === 'Write') return snap(10);
    if (opts.phase === 'Review') return opts.label === 'review:test-runner' ? { findings: [t] } : { findings: [] };
    return { findings: [] };
  };
  const run = new AsyncFunction('agent', 'parallel', 'phase', withTester(TESTER_TYPE));
  const res = await run(agent, parallel, phase);
  assert.equal(res.stoppedBy, null, 'a baseline (pre-existing) test failure must not block merge');
  assert.equal(res.iterations, 1, 'must exit ready on iteration 1');
  assert.equal(res.baselineFailures.length, 1, 'the pre-existing failure must be surfaced in the report');
});

test('baseline: a NEW test failure (not in baseline) still blocks and drives a fix', async () => {
  const legacy = failing('test_legacy');
  const fresh = failing('test_new');
  let round = 0;
  const agent = async (_prompt, opts) => {
    if (opts.phase === 'Baseline') return { findings: [legacy] };
    if (opts.phase === 'Write') return snap(10);
    if (opts.phase === 'Review') {
      if (opts.label !== 'review:test-runner') return { findings: [] };
      return round === 0 ? { findings: [legacy, fresh] } : { findings: [legacy] };  // fresh failure only round 1
    }
    if (opts.phase === 'Fix') { round++; return snap(20 + round); }
    return { findings: [] };
  };
  const run = new AsyncFunction('agent', 'parallel', 'phase', withTester(TESTER_TYPE));
  const res = await run(agent, parallel, phase);
  assert.equal(res.stoppedBy, null, `expected clean exit after fixing the new failure, got: ${res.stoppedBy}`);
  assert.equal(res.iterations, 2, 'the NEW failure must block round 1 and clear by round 2');
});

// ─── Supplementary reviewer agentType passthrough ───
// Verify that the full registered name set in SUPPLEMENTARY flows through to agent() opts.agentType
// exactly (no truncation or namespace mangling inside the script).

const SEC_TYPE = 'comprehensive-review:comprehensive-review-security-auditor';

function withSupplementary(entries) {
  return RAW_SRC.replace(
    /const SUPPLEMENTARY\s*=\s*\[\][^\n]*/,
    `const SUPPLEMENTARY = ${JSON.stringify(entries)}`,
  );
}

test('supplementary security-auditor agentType flows through to agent() call unchanged', async () => {
  const calls = [];
  const agent = async (_prompt, opts) => {
    calls.push(opts);
    if (opts.phase === 'Write') return snap(10);
    return { findings: [] };
  };
  const src = withSupplementary([{ type: SEC_TYPE, label: 'security-auditor', power: { model: 'opus', effort: 'xhigh' } }]);
  const run = new AsyncFunction('agent', 'parallel', 'phase', src);
  await run(agent, parallel, phase);
  const secAudit = calls.find((c) => c.label === 'review:security-auditor');
  assert.ok(secAudit, `security-auditor call not found in: ${JSON.stringify(calls.map(c => c.label))}`);
  assert.equal(secAudit.agentType, SEC_TYPE,
    'the full agentType must be preserved — short form causes "agent type not found" at runtime');
  assert.equal(secAudit.model, 'opus');
  assert.equal(secAudit.effort, 'xhigh');
});

test('supplementary silent-failure-hunter dispatches on sonnet @ high (not xhigh)', async () => {
  const calls = [];
  const agent = async (_prompt, opts) => {
    calls.push(opts);
    if (opts.phase === 'Write') return snap(10);
    return { findings: [] };
  };
  const src = withSupplementary([{ type: 'silent-failure-hunter', label: 'silent-failure-hunter', power: { model: 'sonnet', effort: 'high' } }]);
  const run = new AsyncFunction('agent', 'parallel', 'phase', src);
  await run(agent, parallel, phase);
  const sfh = calls.find((c) => c.label === 'review:silent-failure-hunter');
  assert.ok(sfh, 'silent-failure-hunter call not found');
  assert.equal(sfh.model, 'sonnet');
  assert.equal(sfh.effort, 'high');
});

test('supplementary comment-analyzer dispatches on haiku with no effort', async () => {
  const calls = [];
  const agent = async (_prompt, opts) => {
    calls.push(opts);
    if (opts.phase === 'Write') return snap(10);
    return { findings: [] };
  };
  const src = withSupplementary([{ type: 'comment-analyzer', label: 'comment-analyzer', power: { model: 'haiku' } }]);
  const run = new AsyncFunction('agent', 'parallel', 'phase', src);
  await run(agent, parallel, phase);
  const ca = calls.find((c) => c.label === 'review:comment-analyzer');
  assert.ok(ca, 'comment-analyzer call not found');
  assert.equal(ca.model, 'haiku');
  assert.equal(ca.effort, undefined, 'Haiku must not receive effort (it 400s otherwise)');
});

// ─── review-loop.md documents TESTER ───

test('review-loop.md script has TESTER_POWER constant beside TESTER', () => {
  assert.match(RAW_SRC, /const TESTER_POWER\s*=/);
});

test('review-loop.md prose documents that test-runner fires in parallel with reviewers each round', () => {
  assert.match(md, /TESTER/);
  assert.match(md, /parallel/i);
  assert.match(md, /test.runner|test runner/i);
});

// ─── TEST_PROMPT must-not-override guard ───
// Root cause: the orchestrator silently replaced TEST_PROMPT with "unit tests only (no Docker)"
// because the docs did not forbid it. These tests verify that the documentation explicitly
// prohibits overriding TEST_PROMPT and that the script itself marks the constant as fixed.

test('review-loop.md prose explicitly states TEST_PROMPT must NOT be modified by the orchestrator', () => {
  assert.match(
    md,
    /do not.{0,20}modify.{0,60}TEST_PROMPT|TEST_PROMPT.{0,60}must not.{0,40}modif/i,
    'The "How to run / adapt" section must contain an explicit warning that TEST_PROMPT must not be overridden',
  );
});

test('review-loop.md script has a DO NOT MODIFY comment on the TEST_PROMPT constant', () => {
  // The comment must appear within 3 lines of the TEST_PROMPT declaration so it is clearly associated.
  const lines = RAW_SRC.split('\n');
  const tpIdx = lines.findIndex((l) => /const TEST_PROMPT\s*=/.test(l));
  assert.ok(tpIdx !== -1, 'TEST_PROMPT constant not found in script');
  const window = lines.slice(Math.max(0, tpIdx - 3), tpIdx + 1).join('\n');
  assert.match(
    window,
    /do not.{0,10}modify|DO NOT MODIFY/i,
    'A "DO NOT MODIFY" comment must appear within 3 lines before the TEST_PROMPT constant',
  );
});

test('review-loop.md fill-in paragraph names only the nine config constants and does NOT include TEST_PROMPT', () => {
  // TEST_PROMPT is a fixed constant, not a fill-in slot. If it appeared in the fill-in constants
  // paragraph the orchestrator might treat it as something it is expected to customise.
  // The fill-in list is a single line starting with "Paste this script" that ends with "Iterate with …".
  // (The CRITICAL block that follows intentionally *mentions* TEST_PROMPT to forbid overriding it —
  // we must not capture that block here.)
  const fillLine = md.split('\n').find((l) => l.startsWith('Paste this script') && l.includes('Iterate with'));
  assert.ok(fillLine, 'Could not locate the "Paste this script … Iterate with …" fill-in line in review-loop.md');
  assert.doesNotMatch(
    fillLine,
    /TEST_PROMPT/,
    'TEST_PROMPT must NOT appear in the fill-in constants line — it is a fixed constant, not a slot',
  );
});
