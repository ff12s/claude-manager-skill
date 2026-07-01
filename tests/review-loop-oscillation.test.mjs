// Oscillation-guard tests for the Review Loop.
// Runs the ACTUAL Workflow script extracted from skills/review-loop/review-loop.md (no drift) with
// stubbed agent()/parallel()/phase(), driving the pathological case the guard exists for:
// fresh independent reviewers reverse each other on a subjective point (round N asks A, round N+1
// reverses to B) so the change ping-pongs between two states. The guard must:
//   1. detect the cycle (curSnap matches a state reviewed >=2 rounds ago) instead of running to HARD CAP,
//   2. invoke ONE senior arbiter to LOCK a decision (injected as spec into later reviewers + the fixer),
//      letting the loop converge, and
//   3. escalate OSCILLATION-UNRESOLVED if it is still cycling after ARBITER_MAX (2) rulings.
// It must NOT false-fire when snapshots change monotonically (real progress).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const md = readFileSync(join(here, '..', 'skills', 'review-loop', 'review-loop.md'), 'utf8');

const m = md.match(/```js\r?\n([\s\S]*?)\r?\n```/);
assert.ok(m, 'review-loop.md must contain a ```js fenced Workflow script');
const SRC = m[1].replace(/^export\s+const\s+meta/m, 'const meta');

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const makeRun = () => new AsyncFunction('agent', 'parallel', 'phase', 'args', SRC);

const phase = () => {};
const parallel = async (thunks) => Promise.all(thunks.map((t) => t()));
const baseArgs = { task: 't', writer: 'w', reviewer: 'r', supplementary: [], scopeHint: '', grounding: '' };

// Snapshots keyed by a tag so snapEqual (size+head+tail) can tell states apart / recognise a repeat.
const snap = (tag, size) => ({ snapshot: [{ path: 'a.py', size, head: `state ${tag}`, tail: tag }], decisions: [] });
const snapDec = (tag, size, decisions) => ({ snapshot: [{ path: 'a.py', size, head: `state ${tag}`, tail: tag }], decisions });
const A = snap('A', 10);
const B = snap('B', 20);
const C = snap('C', 30);
// A must-fix finding that "demands" a given approach — distinct wording per approach => distinct fingerprint.
const demand = (want) => ({
  findings: [{ severity: 'high', file: 'a.py', line: 1, first8: `demand approach ${want.toLowerCase()}`, explanation: `switch to approach ${want}` }],
});
const clean = { findings: [] };

/**
 * scenario = { writer, reviews: [perIteration], fixes: [perIteration], ruling }
 * reviews[i] is returned by the single mandatory reviewer on iteration i+1; fixes[i] by the fixer.
 */
function makeAgent(scenario, caps = {}) {
  let ri = 0;
  let fi = 0;
  return async (prompt, opts) => {
    if (opts.phase === 'Write') return scenario.writer;
    if (opts.phase === 'Review') {
      caps.reviewPrompts?.push(prompt);
      const r = ri < scenario.reviews.length ? scenario.reviews[ri] : clean;
      ri++;
      return r;
    }
    if (opts.phase === 'Arbitrate') {
      caps.arbiterPrompts?.push(prompt);
      return scenario.ruling ?? { decision: 'use approach A', rationale: 'simpler and closer to current code' };
    }
    if (opts.phase === 'Fix') {
      caps.fixPrompts?.push(prompt);
      const f = fi < scenario.fixes.length ? scenario.fixes[fi] : scenario.fixes[scenario.fixes.length - 1];
      fi++;
      return f;
    }
    return clean;
  };
}

async function runScenario(scenario, caps) {
  const run = makeRun();
  return run(makeAgent(scenario, caps), parallel, phase, baseArgs);
}

test('OSCILLATION: A→B→A ping-pong is detected and the arbiter locks a decision → loop converges', async () => {
  // iter1 review demands B → fix B; iter2 demands A → fix A (curSnap back to A, the writer state);
  // iter3 demands B, but curSnap==A matches the state reviewed 2 rounds ago → ARBITER fires, fix→C (locked);
  // iter4 clean → EXIT-READY.
  const caps = { reviewPrompts: [], arbiterPrompts: [] };
  const res = await runScenario(
    {
      writer: A,
      reviews: [demand('B'), demand('A'), demand('B'), clean],
      fixes: [B, A, C],
    },
    caps,
  );
  assert.equal(res.stoppedBy, null, `expected clean exit via arbiter, got: ${res.stoppedBy}`);
  assert.equal(res.iterations, 4);
  assert.equal(res.arbiterRulings.length, 1, 'exactly one arbiter ruling should resolve the oscillation');
  assert.equal(caps.arbiterPrompts.length, 1, 'arbiter dispatched exactly once');
});

test('OSCILLATION: the arbiter prompt carries BOTH sides of the ping-pong, not just the current round', async () => {
  const caps = { arbiterPrompts: [] };
  await runScenario({ writer: A, reviews: [demand('B'), demand('A'), demand('B'), clean], fixes: [B, A, C] }, caps);
  assert.equal(caps.arbiterPrompts.length, 1);
  const p = caps.arbiterPrompts[0];
  assert.match(p, /<competing-findings>/, 'arbiter must receive the competing findings block');
  assert.match(p, /Previous round asked for/, 'prior round demand must be labelled');
  assert.match(p, /This round reverses to/, 'current round reversal must be labelled');
  assert.match(p, /switch to approach A/, 'the A-side demand (previous round) must be present');
  assert.match(p, /switch to approach B/, 'the B-side demand (current round) must be present');
});

test('decision ledger: defended decisions ACCUMULATE across rounds (not replaced) and all reach the later fixer', async () => {
  // Distinct snapshots (A,D1,D2,D3) → no oscillation. demand('B') each round keeps must-fix open so 3 fixers run.
  const caps = { fixPrompts: [] };
  const dec1 = { file: 'a.py', line: 7, decision: 'kept the write in a single transaction', rationale: 'task requires one-tx' };
  const dec2 = { file: 'b.py', line: 3, decision: 'kept the composite index', rationale: 'lookup pattern needs it' };
  const res = await runScenario(
    {
      writer: A,
      reviews: [demand('B'), demand('B'), demand('B'), clean],
      fixes: [snapDec('D1', 25, [dec1]), snapDec('D2', 40, [dec2]), snap('D3', 55)],
    },
    caps,
  );
  assert.equal(res.stoppedBy, null, `expected clean exit, got: ${res.stoppedBy}`);
  assert.equal(caps.fixPrompts.length, 3, 'three fixes should run');
  assert.doesNotMatch(caps.fixPrompts[0], /<prior-decisions>/, 'first fix has no prior decisions');
  // Second fixer sees dec1 only (not yet dec2).
  assert.match(caps.fixPrompts[1], /single transaction/);
  assert.doesNotMatch(caps.fixPrompts[1], /composite index/);
  // Third fixer must see BOTH — a plain replace (priorDecisions = fixerOut.decisions) would drop dec1 here.
  assert.match(caps.fixPrompts[2], /single transaction/, 'accumulated round-1 decision must survive to the third fixer');
  assert.match(caps.fixPrompts[2], /composite index/, 'round-2 decision must also be present');
});

test('decision ledger: a same-key decision OVERWRITES (Map dedupe by file|line), no duplicate entry', async () => {
  const caps = { fixPrompts: [] };
  const older = { file: 'a.py', line: 7, decision: 'kept single transaction', rationale: 'OLD-REASON' };
  const newer = { file: 'a.py', line: 7, decision: 'kept single transaction', rationale: 'NEW-REASON' };
  const res = await runScenario(
    {
      writer: A,
      reviews: [demand('B'), demand('B'), demand('B'), clean],
      fixes: [snapDec('D1', 25, [older]), snapDec('D2', 40, [newer]), snap('D3', 55)],
    },
    caps,
  );
  assert.equal(res.stoppedBy, null, `expected clean exit, got: ${res.stoppedBy}`);
  const p = caps.fixPrompts[2];
  assert.match(p, /NEW-REASON/, 'the updated same-key decision must be present');
  assert.doesNotMatch(p, /OLD-REASON/, 'the superseded same-key decision must be overwritten, not kept');
  assert.equal((p.match(/a\.py:7/g) || []).length, 1, 'exactly one ledger entry for the same file|line');
});

test('OSCILLATION: the locked decision is injected into later reviewer prompts as spec', async () => {
  const caps = { reviewPrompts: [] };
  await runScenario({ writer: A, reviews: [demand('B'), demand('A'), demand('B'), clean], fixes: [B, A, C] }, caps);
  // Reviews before the arbiter (iters 1–3) carry no lock; the review after it (iter 4) must.
  assert.doesNotMatch(caps.reviewPrompts[0], /LOCKED DECISIONS/, 'first review must not carry a lock');
  assert.match(caps.reviewPrompts.at(-1), /LOCKED DECISIONS/, 'post-arbiter review must carry the locked decision');
  assert.match(caps.reviewPrompts.at(-1), /use approach A/, 'the arbiter decision text must appear in the lock');
});

test('OSCILLATION-UNRESOLVED: still cycling after ARBITER_MAX (2) rulings → stop and escalate', async () => {
  // Reviewers keep reversing and the fixer keeps toggling A/B regardless of the lock.
  const caps = { arbiterPrompts: [] };
  const res = await runScenario(
    {
      writer: A,
      reviews: [demand('B'), demand('A'), demand('B'), demand('A'), demand('B')],
      fixes: [B, A, B, A],
    },
    caps,
  );
  assert.match(res.stoppedBy, /OSCILLATION-UNRESOLVED/);
  assert.equal(res.arbiterRulings.length, 2, 'gives up after exactly ARBITER_MAX rulings');
  assert.equal(res.iterations, 5);
});

test('no false-fire: monotonically changing snapshots converge without any arbiter', async () => {
  // Distinct snapshot every round (real progress) → no state ever repeats → oscillation must not trigger.
  const res = await runScenario({
    writer: A,
    reviews: [demand('B'), demand('C'), clean],
    fixes: [B, C],
  });
  assert.equal(res.stoppedBy, null);
  assert.equal(res.iterations, 3);
  assert.equal(res.arbiterRulings.length, 0, 'no oscillation → arbiter must not be invoked');
});

// --- static contract: the new mechanism is present in the script + prose ---

test('static: script defines ARBITER, ARBITER_POWER and ARBITER_MAX constants', () => {
  assert.match(SRC, /const ARBITER\s*=/);
  assert.match(SRC, /const ARBITER_POWER\s*=/);
  assert.match(SRC, /const ARBITER_MAX\s*=/);
});

test('static: REVIEW_PROMPT enforces severity discipline (objective defects only for critical/high)', () => {
  assert.match(SRC, /Severity discipline/);
  assert.match(SRC, /never critical\/high/);
});

test('static: SNAP_SCHEMA carries an optional decisions field (writer/fixer decision ledger)', () => {
  assert.match(SRC, /decisions:\s*\{\s*type:\s*'array'/);
});

test('static: the fixer prompt receives prior-decisions so it does not silently reverse itself', () => {
  assert.match(SRC, /<prior-decisions>/);
});

test('static: review-loop.md stop-conditions table documents OSCILLATION and OSCILLATION-UNRESOLVED', () => {
  assert.match(md, /OSCILLATION \(not a stop\)/);
  assert.match(md, /OSCILLATION-UNRESOLVED/);
});

test('static: manager SKILL.md documents the oscillation guard / arbiter tiebreaker', () => {
  const skill = readFileSync(join(here, '..', 'skills', 'manager', 'SKILL.md'), 'utf8');
  assert.match(skill, /Oscillation guard/);
  assert.match(skill, /architect-review/);
});
