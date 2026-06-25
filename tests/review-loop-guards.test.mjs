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

test('static: script defines all seven fill-in constants (WRITER, REVIEWER, SUPPLEMENTARY, WRITER_POWER, TASK, GROUNDING, SCOPE_HINT)', () => {
  assert.match(SRC, /const WRITER\s*=/);
  assert.match(SRC, /const REVIEWER\s*=/);
  assert.match(SRC, /const SUPPLEMENTARY\s*=/);
  assert.match(SRC, /const WRITER_POWER\s*=/);
  assert.match(SRC, /const TASK\s*=/);
  assert.match(SRC, /const GROUNDING\s*=/);
  assert.match(SRC, /const SCOPE_HINT\s*=/);
});

test('static: stop-conditions table in review-loop.md documents WRITER-EMPTY guard', () => {
  assert.match(md, /WRITER-EMPTY/);
});
