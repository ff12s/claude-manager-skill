// Guard-logic tests for the Review Loop.
// We run the ACTUAL Workflow script extracted from references/review-loop.md (no drift) with
// stubbed agent()/parallel()/phase() and scripted findings, then assert the guard outcomes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const skillDir = join(here, '..', 'skills', 'manager');
const md = readFileSync(join(skillDir, 'references', 'review-loop.md'), 'utf8');

// Extract the single ```js fenced block (the canonical Workflow script).
const m = md.match(/```js\r?\n([\s\S]*?)\r?\n```/);
assert.ok(m, 'review-loop.md must contain a ```js fenced Workflow script');
const SRC = m[1].replace(/^export\s+const\s+meta/m, 'const meta'); // strip top-level export for eval

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
// The script body ends each iteration path with `return finish(...)`, so wrapping it in an
// async function makes those returns resolve to the loop's `result`.
const makeRun = () => new AsyncFunction('agent', 'parallel', 'phase', 'args', SRC);

const phase = () => {};
const parallel = async (thunks) => Promise.all(thunks.map((t) => t()));

const snap = (size) => ({ snapshot: [{ path: 'a.py', size, head: 'head', tail: 'tail' }] });
const H = (file, line) => ({ severity: 'high', file, line, first8: `fp ${file} ${line}`, explanation: 'e' });

/** scenario = { writer, rounds: [{ reviews: [reviewResultPerReviewer...], fix }] } */
function makeAgent(scenario) {
  let round = 0;
  let rev = 0;
  return async (_prompt, opts) => {
    if (opts.phase === 'Write') return scenario.writer;
    if (opts.phase === 'Review') {
      const arr = scenario.rounds[round]?.reviews ?? [];
      const r = rev < arr.length ? arr[rev] : { findings: [] };
      rev++;
      return r;
    }
    if (opts.phase === 'Fix') {
      const fx = scenario.rounds[round]?.fix ?? snap(999);
      round++;
      rev = 0;
      return fx;
    }
    return { findings: [] };
  };
}

const baseArgs = { task: 't', writer: 'w', reviewer: 'r', supplementary: [], scopeHint: '', grounding: '' };

async function runScenario(scenario) {
  const run = makeRun();
  return run(makeAgent(scenario), parallel, phase, baseArgs);
}

test('EXIT-OK: zero must-fix findings → clean stop on iteration 1', async () => {
  const res = await runScenario({ writer: snap(10), rounds: [{ reviews: [{ findings: [] }] }] });
  assert.equal(res.stoppedBy, null);
  assert.equal(res.iterations, 1);
});

test('PRE-GUARD-0: mandatory reviewer returns null → health-check stop', async () => {
  const res = await runScenario({ writer: snap(10), rounds: [{ reviews: [null] }] });
  assert.match(res.stoppedBy, /PRE-GUARD-0/);
});

test('GUARD 2 (sticky): a must-fix fingerprint recurs next iteration → stop', async () => {
  const res = await runScenario({
    writer: snap(10),
    rounds: [
      { reviews: [{ findings: [H('a.py', 1)] }], fix: snap(20) },
      { reviews: [{ findings: [H('a.py', 1)] }] }, // same fingerprint persists
    ],
  });
  assert.match(res.stoppedBy, /GUARD 2/);
  assert.equal(res.iterations, 2);
});

test('GUARD 3 (no-progress): must-fix count flat with all-new findings → stop', async () => {
  const res = await runScenario({
    writer: snap(10),
    rounds: [
      { reviews: [{ findings: [H('a.py', 1), H('b.py', 2)] }], fix: snap(20) }, // mustfix 2
      { reviews: [{ findings: [H('c.py', 3), H('d.py', 4)] }] }, // mustfix 2, all new
    ],
  });
  assert.match(res.stoppedBy, /GUARD 3/);
});

test('GUARD 4 (regression): fewer must-fix but a new critical/high appears → stop', async () => {
  const res = await runScenario({
    writer: snap(10),
    rounds: [
      { reviews: [{ findings: [H('a.py', 1), H('b.py', 2)] }], fix: snap(20) }, // mustfix 2
      { reviews: [{ findings: [H('c.py', 3)] }] }, // mustfix 1 (progress) but c is new
    ],
  });
  assert.match(res.stoppedBy, /GUARD 4/);
});
