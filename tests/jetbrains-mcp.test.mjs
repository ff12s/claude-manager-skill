// TDD guard for JetBrains MCP integration, now owned by the extracted `code-discovery` skill.
//
// PyCharm 2025.2+ ships a built-in MCP server (com.intellij.mcpServer) that exposes the live
// IDE index over SSE at http://localhost:64342/sse. These tests assert that the code-discovery
// skill documents the jetbrains → codebase-memory → grep ladder so the orchestrator prefers live
// IDE tools over raw Grep/Read for code-structure questions (symbol search, references, go-to-def),
// and that the `manager` skill delegates code search to code-discovery.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const cd = readFileSync(join(here, '..', 'skills', 'code-discovery', 'SKILL.md'), 'utf8');
const managerBody = readFileSync(join(here, '..', 'skills', 'manager', 'SKILL.md'), 'utf8');

/** Return the markdown of the section started by the first heading matching headingRegex,
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

const processSection = sectionAfter(managerBody, /^## Process/);

// ─── code-discovery skill documents the jetbrains-first ladder ─────────────

test('code-discovery SKILL.md exists and names jetbrains', () => {
  assert.match(cd, /jetbrains/i, 'code-discovery must document the jetbrains MCP');
});

test('code-discovery documents the symbol search tool', () => {
  assert.match(cd, /search_symbol|search_in_files/i,
    'code-discovery must document the symbol search tool for jetbrains MCP');
});

test('code-discovery documents get_symbol_info or find_usages tool', () => {
  assert.match(cd, /get_symbol_info|find_usages|find_referencing/i,
    'code-discovery must document symbol-info or find-usages tool for jetbrains MCP');
});

test('code-discovery references the live IDE index (not raw grep)', () => {
  assert.match(cd, /IDE index|live index|ide index|PyCharm index/i,
    'code-discovery must explain that jetbrains MCP uses the live IDE index');
});

test('code-discovery lists jetbrains before codebase-memory-mcp (priority order)', () => {
  const jbIdx = cd.indexOf('jetbrains');
  const cbmIdx = cd.indexOf('codebase-memory-mcp');
  assert.ok(jbIdx !== -1, 'jetbrains missing from code-discovery');
  assert.ok(cbmIdx !== -1, 'codebase-memory-mcp missing from code-discovery');
  assert.ok(jbIdx < cbmIdx,
    'jetbrains must appear BEFORE codebase-memory-mcp in code-discovery (highest priority first)');
});

test('code-discovery documents an explicit fallback chain', () => {
  assert.match(cd, /fall.?back|unavailable|fails|not.*reachable/i,
    'code-discovery must describe when to fall back from jetbrains to the next option');
});

test('code-discovery names Grep/Read as last resort (after both MCP servers)', () => {
  assert.match(cd, /last.?resort|only.*when.*both|both.*MCP.*fail/i,
    'code-discovery must describe Grep/Read as last resort, not a first-line tool');
});

test('code-discovery has an explicit "never grep for symbol lookup" rule', () => {
  assert.match(cd, /never.*grep.*symbol|never.*reach.*grep|never.*grep.*reference/i,
    'code-discovery must explicitly forbid using Grep for symbol lookup when jetbrains is reachable');
});

test('code-discovery references the jetbrains-mcp-probe SessionStart hook', () => {
  assert.match(cd, /jetbrains-mcp-probe/i,
    'code-discovery must reference the jetbrains-mcp-probe hook that reports MCP reachability');
});

// ─── manager delegates code search to code-discovery ───────────────────────

test('manager Process section delegates code search to the code-discovery skill', () => {
  assert.ok(processSection, 'manager SKILL.md must contain a "## Process" section');
  assert.match(processSection, /code-discovery/i,
    'manager Process section must invoke the code-discovery skill for code search');
  assert.match(processSection, /jetbrains/i,
    'manager Process section must still name jetbrains as the preferred code-search tool');
});
