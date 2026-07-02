// Artifact-consistency tests for the /manager skill.
// These assert that the skill TEXT encodes the rules we rely on — a skill is instructions,
// so "presence of the rule" is the testable contract. Scoped to sections to avoid false greens.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const skillDir = join(here, '..', 'skills', 'manager');
const body = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');

/** Return the markdown of the section started by the first heading matching `headingRegex`,
 *  up to (not including) the next heading of the same or higher level. null if not found. */
function sectionAfter(md, headingRegex) {
  const lines = md.split('\n');
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+/);
    if (m && headingRegex.test(lines[i])) {
      start = i;
      level = m[1].length;
      break;
    }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+/);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

const hygiene = sectionAfter(body, /Workflow dispatch hygiene/i);

test('body has a "Workflow dispatch hygiene" section', () => {
  assert.ok(hygiene, 'SKILL.md must contain a "Workflow dispatch hygiene" section');
});

test('hygiene rule A: CWD = repo root, never cd into nested repos', () => {
  assert.ok(hygiene, 'hygiene section missing');
  assert.match(hygiene, /repo root/i);
  assert.match(hygiene, /nested/i);
});

test('hygiene rule B: fresh script per dispatch; scriptPath reuse replays cache', () => {
  assert.ok(hygiene, 'hygiene section missing');
  assert.match(hygiene, /resumeFromRunId/);
  assert.match(hygiene, /cache/i);
});

test('hygiene rule C: verify the disk after a Workflow, do not trust the report', () => {
  assert.ok(hygiene, 'hygiene section missing');
  assert.match(hygiene, /git -C/);
  assert.match(hygiene, /status|diff/i);
  assert.match(hygiene, /report/i);
});

test('hygiene rule D: direct edit is a BOUNDED exception (≤2 files, rename/typo class) with review still required', () => {
  assert.ok(hygiene, 'hygiene section missing');
  assert.match(hygiene, /(≤\s*2|two)\s*files/i, 'the direct-edit exception must be bounded by a file count');
  assert.match(hygiene, /rename|typo/i, 'the exception must enumerate the trivial change classes it covers');
  assert.match(hygiene, /review/i, 'a review must still run even for the bounded exception');
});

test('no unbounded escape hatch: SKILL.md never states a "prefer a direct edit" preference', () => {
  assert.doesNotMatch(body, /prefer a direct edit/i,
    'the always-delegate rule must not be cancelled by a "prefer a direct edit" preference anywhere');
});

// ─── dispatch section states the Workflow opt-in explicitly ────────────────
const dispatch = sectionAfter(body, /Dispatch mechanism/i);

test('dispatch section states the Workflow opt-in explicitly', () => {
  assert.ok(dispatch, 'Dispatch mechanism section missing');
  assert.match(dispatch, /opt-in/i, 'must state that invoking /manager is the Workflow opt-in');
  assert.match(dispatch, /Workflow/, 'the opt-in statement must reference the Workflow tool');
});

// ─── Rules section: loop is the default, not "expensive"; no escape hatch ───
const rules = sectionAfter(body, /^##\s+Rules/m);

test('Rules section does not frame the loop as expensive (no cost scare)', () => {
  assert.ok(rules, 'Rules section missing');
  assert.doesNotMatch(rules, /loop is expensive/i, 'the loop must not be advertised as expensive');
  assert.doesNotMatch(rules, /prefer a direct edit/i, 'Rules must not license skipping the loop via a direct edit');
});

// ─── Process requires a commitment preamble before dispatching ─────────────
const processSec = sectionAfter(body, /^##\s+Process/m);

test('Process section requires a commitment preamble before dispatching', () => {
  assert.ok(processSec, 'Process section missing');
  assert.match(processSec, /before the first code-changing dispatch/i, 'must require a plan before the first dispatch');
  assert.match(processSec, /one[- ]line plan/i, 'must require a one-line dispatch plan');
  assert.match(processSec, /(don't|do not) edit files/i, 'must restate that the orchestrator does not edit files');
});

// ─── delegation rule intact (regression guard) ────────────────────────────
test('Rules section keeps the "you don\'t implement" delegation rule', () => {
  assert.ok(rules, 'Rules section missing');
  assert.match(rules, /(don't|do not) implement/i, 'the orchestrator-does-not-implement rule must remain');
});

// ─── every skill in the monorepo has valid frontmatter ─────────────────────

const skillsRoot = join(here, '..', 'skills');
const ALL_SKILLS = ['manager', 'code-discovery', 'context7-grounding', 'review-loop'];

for (const name of ALL_SKILLS) {
  test(`skill "${name}" has valid frontmatter (name + description)`, () => {
    const md = readFileSync(join(skillsRoot, name, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
    assert.ok(md.startsWith('---\n'), `${name}/SKILL.md must open with a YAML frontmatter block`);
    const fm = md.slice(4, md.indexOf('\n---', 4));
    const nameMatch = fm.match(/^name:\s*(.+)$/m);
    assert.ok(nameMatch, `${name}/SKILL.md frontmatter must declare name:`);
    assert.equal(nameMatch[1].trim(), name, `${name}/SKILL.md frontmatter name must equal "${name}"`);
    const descMatch = fm.match(/^description:\s*(.+)$/m);
    assert.ok(descMatch && descMatch[1].trim().length > 20,
      `${name}/SKILL.md frontmatter must declare a non-trivial description:`);
  });
}

// ─── stop-condition names stay consistent across the three files that document them ───
// The stop-conditions list is duplicated in manager/SKILL.md, review-loop/SKILL.md and
// review-loop/review-loop.md; a past edit left one copy stale. This guards every name in all three.
test('stop-condition names are consistent across manager, the review-loop skill, and review-loop.md', () => {
  const files = {
    'manager/SKILL.md': body,
    'review-loop/SKILL.md': readFileSync(join(skillsRoot, 'review-loop', 'SKILL.md'), 'utf8'),
    'review-loop/review-loop.md': readFileSync(join(skillsRoot, 'review-loop', 'review-loop.md'), 'utf8'),
  };
  const NAMES = ['WRITER-EMPTY', 'PRE-GUARD-0', 'EXIT-READY', 'HARD CAP', 'OSCILLATION-UNRESOLVED', 'STAGNATION'];
  for (const [file, text] of Object.entries(files)) {
    for (const n of NAMES) {
      assert.ok(text.includes(n), `${file} must document the "${n}" stop condition (drift guard)`);
    }
  }
});

// ─── manager delegates to the three extracted sub-skills ───────────────────

for (const sub of ['code-discovery', 'context7-grounding', 'review-loop']) {
  test(`manager SKILL.md references the "${sub}" sub-skill`, () => {
    assert.match(body, new RegExp(sub),
      `manager SKILL.md must reference the extracted ${sub} skill`);
  });
}

test('manager SKILL.md no longer points at the moved reference files', () => {
  assert.doesNotMatch(body, /references\/review-loop\.md/,
    'manager must not link references/review-loop.md (moved to the review-loop skill)');
  assert.doesNotMatch(body, /references\/grounding\.md/,
    'manager must not link references/grounding.md (moved to the context7-grounding skill)');
});
