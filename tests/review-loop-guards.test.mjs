// Guard-logic tests for the Review Loop (loop-until-clean model).
// We run the ACTUAL Workflow script extracted from references/review-loop.md (no drift) with
// stubbed agent()/parallel()/phase() and scripted findings, then assert the loop outcomes.
//
// Model under test:
//   write -> [ fresh independent review -> if must-fix: fix ] until a review is clean, capped at MAX_ITERS=10.
//   Exit-ready = no must-fix (critical/high). Backstops: PRE-GUARD-0, HARD CAP, STAGNATION.
//   Reviewers must be independent: they never receive prior findings or knowledge that a fix happened.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const skillDir = join(here, '..', 'skills', 'manager');
const md = readFileSync(join(skillDir, 'references', 'review-loop.md'), 'utf8');

const m = md.match(/```js\r?\n([\s\S]*?)\r?\n```/);
assert.ok(m, 'review-loop.md must contain a ```js fenced Workflow script');
const SRC = m[1].replace(/^export\s+const\s+meta/m, 'const meta');

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const makeRun = () => new AsyncFunction('agent', 'parallel', 'phase', 'args', SRC);

const phase = () => {};
const parallel = async (thunks) => Promise.all(thunks.map((t) => t()));

const snap = (size) => ({ snapshot: [{ path: 'a.py', size, head: 'head', tail: 'tail' }] });
const H = (file, line) => ({ severity: 'high', file, line, first8: `fp ${file} ${line}`, explanation: 'e' });
const clean = { findings: [] };

/** scenario = { writer, rounds: [{ reviews: [reviewResultPerReviewer...], fix }] }
 *  capturedReviewPrompts collects every prompt sent to a Review-phase agent (independence checks). */
function makeAgent(scenario, capturedReviewPrompts) {
  let round = 0;
  let rev = 0;
  return async (prompt, opts) => {
    if (opts.phase === 'Write') return scenario.writer;
    if (opts.phase === 'Review') {
      capturedReviewPrompts?.push(prompt);
      const arr = scenario.rounds[round]?.reviews ?? [];
      const r = rev < arr.length ? arr[rev] : clean;
      rev++;
      return r;
    }
    if (opts.phase === 'Fix') {
      const fx = scenario.rounds[round]?.fix ?? snap(900 + round);
      round++;
      rev = 0;
      return fx;
    }
    return clean;
  };
}

const baseArgs = { task: 't', writer: 'w', reviewer: 'r', supplementary: [], scopeHint: '', grounding: '' };

async function runScenario(scenario, capturedReviewPrompts) {
  const run = makeRun();
  return run(makeAgent(scenario, capturedReviewPrompts), parallel, phase, baseArgs);
}

test('EXIT-READY: a clean review (no must-fix) exits ready on iteration 1', async () => {
  const res = await runScenario({ writer: snap(10), rounds: [{ reviews: [clean] }] });
  assert.equal(res.stoppedBy, null);
  assert.equal(res.iterations, 1);
});

test('PRE-GUARD-0: mandatory reviewer returns null → health-check stop', async () => {
  const res = await runScenario({ writer: snap(10), rounds: [{ reviews: [null] }] });
  assert.match(res.stoppedBy, /PRE-GUARD-0/);
});

test('loops across multiple rounds until a fresh review is clean', async () => {
  // round1 & round2 each surface (different) must-fix; round3 is clean → ready at iteration 3.
  const res = await runScenario({
    writer: snap(10),
    rounds: [
      { reviews: [{ findings: [H('a.py', 1)] }], fix: snap(20) },
      { reviews: [{ findings: [H('b.py', 2)] }], fix: snap(30) },
      { reviews: [clean] },
    ],
  });
  assert.equal(res.stoppedBy, null, `expected clean exit, got: ${res.stoppedBy}`);
  assert.equal(res.iterations, 3);
});

test('HARD CAP: must-fix persisting past 10 iterations stops at the cap', async () => {
  const rounds = Array.from({ length: 11 }, (_, i) => ({
    reviews: [{ findings: [H(`f${i}.py`, i + 1)] }], // a new must-fix every round (fresh review)
    fix: snap(100 + i), // snapshot changes each round, so STAGNATION never fires
  }));
  const res = await runScenario({ writer: snap(10), rounds });
  assert.match(res.stoppedBy, /HARD CAP/);
  assert.equal(res.iterations, 10);
});

test('STAGNATION: fixer returns identical files → stops early', async () => {
  const same = snap(10);
  const res = await runScenario({
    writer: same,
    rounds: [
      { reviews: [{ findings: [H('a.py', 1)] }], fix: same }, // fixer changes nothing
      { reviews: [{ findings: [H('b.py', 2)] }] },
    ],
  });
  assert.match(res.stoppedBy, /STAGNATION/);
  assert.equal(res.iterations, 2);
});

test('independence: review dispatches never receive prior findings (no FP: tags leak to reviewers)', async () => {
  const prompts = [];
  await runScenario(
    {
      writer: snap(10),
      rounds: [
        { reviews: [{ findings: [H('a.py', 1)] }], fix: snap(20) },
        { reviews: [clean] },
      ],
    },
    prompts,
  );
  assert.ok(prompts.length >= 2, 'expected at least two review rounds');
  for (const p of prompts) {
    assert.doesNotMatch(p, /FP:/, 'reviewer prompt must not carry fixer fingerprint tags');
    assert.doesNotMatch(p, /A review of your change found/, 'reviewer must not be told a fix happened');
  }
});

// --- Regression guard: fingerprint-based, any severity ---
// A "regression" = a finding whose fingerprint (file|line|first8) did NOT appear in the
// previous round's review. Only such findings block EXIT-READY; a medium that persists
// across rounds with the same fingerprint is NOT a regression and does not block exit.

const M = (file, line, tag) => ({ severity: 'medium', file, line, first8: `${tag}`, explanation: 'e' });
const L = (file, line, tag) => ({ severity: 'low', file, line, first8: `${tag}`, explanation: 'e' });

test('no-regression: medium with same fingerprint persisting after fix does NOT block EXIT-READY', async () => {
  // Round 1: must-fix + medium M. priorFPs = {fp(H), fp(M)}.
  // Round 2: same medium M (same fingerprint) → hasRegression=false → EXIT-READY at iter 2.
  const res = await runScenario({
    writer: snap(10),
    rounds: [
      { reviews: [{ findings: [H('a.py', 1), M('b.py', 2, 'orig medium')] }], fix: snap(20) },
      { reviews: [{ findings: [M('b.py', 2, 'orig medium')] }] },  // same FP as round 1
    ],
  });
  assert.equal(res.stoppedBy, null, `expected clean exit, got: ${res.stoppedBy}`);
  assert.equal(res.iterations, 2, 'same-fingerprint medium must not block EXIT-READY');
});

test('regression: new medium introduced by fixer blocks EXIT-READY, loop continues to fix it', async () => {
  // Round 1: must-fix H. priorFPs = {fp(H)}.
  // Round 2: no must-fix, but NEW medium N (fingerprint not in priorFPs) → regression → fix dispatched.
  // Round 3: clean → EXIT-READY at iter 3.
  const res = await runScenario({
    writer: snap(10),
    rounds: [
      { reviews: [{ findings: [H('a.py', 1)] }], fix: snap(20) },
      { reviews: [{ findings: [M('b.py', 2, 'new medium')] }], fix: snap(30) },  // new FP → regression
      { reviews: [clean] },
    ],
  });
  assert.equal(res.stoppedBy, null, `expected clean exit, got: ${res.stoppedBy}`);
  assert.equal(res.iterations, 3, 'regression must cause loop to continue and fix before EXIT-READY');
});

test('regression: new low introduced by fixer also blocks EXIT-READY', async () => {
  const res = await runScenario({
    writer: snap(10),
    rounds: [
      { reviews: [{ findings: [H('a.py', 1)] }], fix: snap(20) },
      { reviews: [{ findings: [L('c.py', 5, 'new low')] }], fix: snap(30) },  // new FP → regression
      { reviews: [clean] },
    ],
  });
  assert.equal(res.stoppedBy, null, `expected clean exit, got: ${res.stoppedBy}`);
  assert.equal(res.iterations, 3, 'low-severity regression must also block EXIT-READY');
});

test('HARD CAP fires when regression findings keep appearing across 10 iterations', async () => {
  // Each round: must-fix fixed but fixer introduces a new medium with a new fingerprint.
  // priorFPs always lacks the new medium → hasRegression=true → loop continues until cap.
  const rounds = [
    { reviews: [{ findings: [H('a.py', 1), M('b.py', 2, 'm0')] }], fix: snap(101) },  // round 1: must-fix
    ...Array.from({ length: 10 }, (_, i) => ({
      reviews: [{ findings: [M(`f${i}.py`, i + 1, `m${i + 1}`)] }],  // new medium each round
      fix: snap(102 + i),
    })),
  ];
  const res = await runScenario({ writer: snap(10), rounds });
  assert.match(res.stoppedBy, /HARD CAP/);
  assert.equal(res.iterations, 10);
});

// --- WRITER-EMPTY guard ---

test('WRITER-EMPTY: writer returns empty snapshot → stops before first review, dispatches=1', async () => {
  const res = await runScenario({ writer: { snapshot: [] }, rounds: [] });
  assert.match(res.stoppedBy, /WRITER-EMPTY/);
  assert.equal(res.iterations, 0, 'loop must not start');
  assert.equal(res.dispatches, 1, 'no reviewer should be dispatched');
});

test('WRITER-EMPTY: writer returns null → stops before first review', async () => {
  const res = await runScenario({ writer: null, rounds: [] });
  assert.match(res.stoppedBy, /WRITER-EMPTY/);
  assert.equal(res.iterations, 0, 'loop must not start');
});

// --- static: inline constants, no args.* ---

test('static: script uses inline constants, not args.* — prevents silent undefined on Workflow args delivery failure', () => {
  assert.doesNotMatch(SRC, /\bargs\.\w+/, 'script must not reference args.* properties (inline as JS constants instead)');
});

test('static: script defines all nine fill-in constants (WRITER, REVIEWER, SUPPLEMENTARY, WRITER_POWER, TASK, GROUNDING, SCOPE_HINT, TESTER, TESTER_POWER)', () => {
  assert.match(SRC, /const WRITER\s*=/);
  assert.match(SRC, /const REVIEWER\s*=/);
  assert.match(SRC, /const SUPPLEMENTARY\s*=/);
  assert.match(SRC, /const WRITER_POWER\s*=/);
  assert.match(SRC, /const TASK\s*=/);
  assert.match(SRC, /const GROUNDING\s*=/);
  assert.match(SRC, /const SCOPE_HINT\s*=/);
  assert.match(SRC, /const TESTER\s*=/);
  assert.match(SRC, /const TESTER_POWER\s*=/);
});

test('static: stop-conditions table in review-loop.md documents WRITER-EMPTY guard', () => {
  assert.match(md, /WRITER-EMPTY/);
});
