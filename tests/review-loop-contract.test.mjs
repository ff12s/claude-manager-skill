// The body's Review Loop semantic contract (and the frontmatter description) must match the
// loop-until-clean model implemented in references/review-loop.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const body = readFileSync(join(here, '..', 'skills', 'manager', 'SKILL.md'), 'utf8');

function sectionAfter(md, headingRegex) {
  const lines = md.split('\n');
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

const contract = sectionAfter(body, /^##\s+Review Loop/);

test('body has a "## Review Loop" semantic-contract section', () => {
  assert.ok(contract, 'SKILL.md must have a "## Review Loop" section');
});

test('contract documents fresh, independent re-review each round', () => {
  assert.ok(contract);
  assert.match(contract, /fresh/i);
  assert.match(contract, /independent/i);
});

test('contract documents loop-until-clean with a 10-iteration hard cap', () => {
  assert.ok(contract);
  assert.match(contract, /\b10\b/);
  assert.match(contract, /cap/i);
});

test('the stop-conditions table lists the real conditions; obsolete guard names (sticky, no-progress) are gone', () => {
  assert.ok(contract);
  // Scope to the markdown table rows: the ACTIVE stop conditions.
  const tableText = contract
    .split('\n')
    .filter((l) => l.trim().startsWith('|'))
    .join('\n');
  assert.match(tableText, /PRE-GUARD-0/i);
  assert.match(tableText, /EXIT-READY/i);
  assert.match(tableText, /HARD CAP/i);
  assert.match(tableText, /STAGNATION/i);
  // These named guards were removed and must not reappear as standalone table entries.
  assert.doesNotMatch(tableText, /sticky/i);
  assert.doesNotMatch(tableText, /no-progress/i);
  // "regression" is now intentionally part of EXIT-READY description (fingerprint-based detection).
});

test('skill no longer overclaims "5 guards" anywhere (incl. frontmatter description)', () => {
  assert.doesNotMatch(body, /5 guards/i);
});

test('ready gate: no must-fix AND no regression (new fingerprints vs prior round)', () => {
  assert.ok(contract, 'contract section missing');
  assert.match(contract, /regression/i, 'contract must mention regression concept');
  assert.match(contract, /fingerprint/i, 'contract must mention fingerprint-based detection');
});

test('test-runner: contract documents running project tests in parallel with reviewers', () => {
  assert.ok(contract, 'contract section missing');
  assert.match(contract, /test/i, 'contract must mention test runner');
  assert.match(contract, /parallel/i, 'contract must mention running tests in parallel with reviewers');
});
