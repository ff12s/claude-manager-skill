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

test('hygiene rule D: direct-edit + read-only review fallback for cross-repo/mechanical work', () => {
  assert.ok(hygiene, 'hygiene section missing');
  assert.match(hygiene, /direct edit/i);
  assert.match(hygiene, /read-only review/i);
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
