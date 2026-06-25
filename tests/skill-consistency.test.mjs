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