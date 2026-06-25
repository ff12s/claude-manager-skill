// Model+effort tier tests.
// (1) Dispatch tiers: run the REAL extracted Workflow script and capture the model/effort each
//     role is dispatched with. (2) Resolver: Haiku gets no effort; xhigh downgrades to max off-Opus.
// (3) Body docs the tiers. Tiers: reviewers/security on Opus, writer/fixer on Sonnet (escalatable),
//     mechanics on Haiku.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const skillDir = join(here, '..', 'skills', 'manager');
const md = readFileSync(join(skillDir, 'references', 'review-loop.md'), 'utf8');
const body = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');

const m = md.match(/```js\r?\n([\s\S]*?)\r?\n```/);
assert.ok(m, 'review-loop.md must contain a ```js fenced Workflow script');
const SRC = m[1].replace(/^export\s+const\s+meta/m, 'const meta');

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const makeRun = () => new AsyncFunction('agent', 'parallel', 'phase', 'args', SRC);
const phase = () => {};
const parallel = async (thunks) => Promise.all(thunks.map((t) => t()));
const snap = (size) => ({ snapshot: [{ path: 'a.py', size, head: 'h', tail: 't' }] });
const H = (file, line) => ({ severity: 'high', file, line, first8: `fp ${file} ${line}`, explanation: 'e' });
const clean = { findings: [] };

// One round of must-fix (forces a fixer dispatch) then a clean round (exit). Exercises writer, reviewers, fixer.
const DEFAULT_ROUNDS = [{ reviews: [{ findings: [H('a.py', 1)] }], fix: snap(20) }, { reviews: [clean] }];

/** Inject overrides into the extracted SRC as constant replacements (no args passing — inline-constants design). */
function makeSrc({ writerPower, supplementary } = {}) {
  let src = SRC;
  if (writerPower) {
    src = src.replace(/const WRITER_POWER\s*=\s*\{[^}]+\}[^\n]*/, `const WRITER_POWER = ${JSON.stringify(writerPower)}`);
  }
  if (supplementary && supplementary.length) {
    src = src.replace(/const SUPPLEMENTARY\s*=\s*\[\][^\n]*/, `const SUPPLEMENTARY = ${JSON.stringify(supplementary)}`);
  }
  return src;
}

async function run({ writerPower, supplementary = [], rounds = DEFAULT_ROUNDS } = {}) {
  const calls = [];
  let round = 0;
  let rev = 0;
  const agent = async (_prompt, opts) => {
    calls.push({ phase: opts.phase, label: opts.label, model: opts.model, effort: opts.effort });
    if (opts.phase === 'Write') return snap(10);
    if (opts.phase === 'Review') {
      const arr = rounds[round]?.reviews ?? [];
      const r = rev < arr.length ? arr[rev] : clean;
      rev++;
      return r;
    }
    if (opts.phase === 'Fix') {
      const fx = rounds[round]?.fix ?? snap(20);
      round++;
      rev = 0;
      return fx;
    }
    return clean;
  };
  const src = makeSrc({ writerPower, supplementary });
  const runFn = new AsyncFunction('agent', 'parallel', 'phase', src);
  await runFn(agent, parallel, phase);
  return calls;
}

const find = (calls, pred) => calls.find(pred);

test('writer is dispatched on sonnet @ high by default', async () => {
  const calls = await run();
  const w = find(calls, (c) => c.phase === 'Write');
  assert.equal(w.model, 'sonnet');
  assert.equal(w.effort, 'high');
});

test('fixer is dispatched on sonnet @ high by default', async () => {
  const calls = await run();
  const f = find(calls, (c) => c.phase === 'Fix');
  assert.equal(f.model, 'sonnet');
  assert.equal(f.effort, 'high');
});

test('mandatory code-reviewer is dispatched on opus @ xhigh', async () => {
  const calls = await run();
  const r = find(calls, (c) => c.phase === 'Review' && c.label === 'review:code-reviewer');
  assert.equal(r.model, 'opus');
  assert.equal(r.effort, 'xhigh');
});

test('writer escalates to opus @ xhigh when WRITER_POWER constant set to {opus, xhigh}', async () => {
  const calls = await run({ writerPower: { model: 'opus', effort: 'xhigh' } });
  const w = find(calls, (c) => c.phase === 'Write');
  assert.equal(w.model, 'opus');
  assert.equal(w.effort, 'xhigh');
});

test('resolver: a Haiku reviewer is dispatched with NO effort (Haiku rejects effort)', async () => {
  const calls = await run({
    supplementary: [{ type: 'comment-analyzer', label: 'comment-analyzer', power: { model: 'haiku' } }],
  });
  const r = find(calls, (c) => c.label === 'review:comment-analyzer');
  assert.equal(r.model, 'haiku');
  assert.equal(r.effort, undefined);
});

test('resolver: xhigh requested off-Opus downgrades to max (xhigh is Opus/Fable only)', async () => {
  const calls = await run({
    supplementary: [{ type: 'sfh', label: 'silent-failure-hunter', power: { model: 'sonnet', effort: 'xhigh' } }],
  });
  const r = find(calls, (c) => c.label === 'review:silent-failure-hunter');
  assert.equal(r.model, 'sonnet');
  assert.equal(r.effort, 'max');
});

// --- body documents the tiers ---

function sectionAfter(text, headingRegex) {
  const lines = text.split('\n');
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const mm = lines[i].match(/^(#{1,6})\s+/);
    if (mm && headingRegex.test(lines[i])) {
      start = i;
      level = mm[1].length;
      break;
    }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const mm = lines[i].match(/^(#{1,6})\s+/);
    if (mm && mm[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

test('dispatch mechanism section documents the model+effort tiers and the resolver', () => {
  const dispatch = sectionAfter(body, /^##\s+Dispatch mechanism/);
  assert.ok(dispatch, 'SKILL.md must have a "## Dispatch mechanism" section');
  assert.match(dispatch, /opus/i);
  assert.match(dispatch, /sonnet/i);
  assert.match(dispatch, /haiku/i);
  assert.match(dispatch, /effort/i);
  assert.match(dispatch, /xhigh/i); // resolver note (xhigh Opus-only)
});

test('skill no longer claims opus+xhigh on every agent', () => {
  assert.doesNotMatch(body, /every agent pinned to/i);
});
