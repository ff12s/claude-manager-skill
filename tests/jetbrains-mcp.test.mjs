// TDD guard for JetBrains MCP integration in the /manager skill.
//
// PyCharm 2025.2+ ships a built-in MCP server (com.intellij.mcpServer) that exposes the live
// IDE index over SSE at http://localhost:64342/sse. These tests assert that the skill
// documents it correctly so the orchestrator prefers live IDE tools over raw Grep/Read
// for code-structure questions (symbol search, references, go-to-definition).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const skillDir = join(here, '..', 'skills', 'manager');
const toolbox = readFileSync(join(skillDir, 'references', 'toolbox.md'), 'utf8');
const body = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');

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

const mcpSection = sectionAfter(toolbox, /MCP servers/i);
const processSection = sectionAfter(body, /^## Process/);

// ─── toolbox.md — MCP servers table ───────────────────────────────────────

test('toolbox.md has a "MCP servers" section', () => {
  assert.ok(mcpSection, 'toolbox.md must contain a "MCP servers" section');
});

test('toolbox.md MCP servers table has a jetbrains row', () => {
  assert.ok(mcpSection, 'MCP servers section missing');
  assert.match(mcpSection, /jetbrains/i,
    'toolbox.md MCP table must include a jetbrains row');
});

test('toolbox.md jetbrains row documents symbol search tool', () => {
  assert.ok(mcpSection, 'MCP servers section missing');
  // search_symbol or search_in_files_by_text — the key symbol-discovery tool
  assert.match(mcpSection, /search_symbol|search_in_files/i,
    'toolbox.md must document the symbol search tool for jetbrains MCP');
});

test('toolbox.md jetbrains row documents get_symbol_info or find_usages tool', () => {
  assert.ok(mcpSection, 'MCP servers section missing');
  assert.match(mcpSection, /get_symbol_info|find_usages|find_referencing/i,
    'toolbox.md must document symbol-info or find-usages tool for jetbrains MCP');
});

test('toolbox.md jetbrains row references the live IDE index (not raw grep)', () => {
  assert.ok(mcpSection, 'MCP servers section missing');
  assert.match(mcpSection, /IDE index|live index|ide index|PyCharm index/i,
    'toolbox.md must explain that jetbrains MCP uses the live IDE index');
});

// ─── SKILL.md — Process section prioritises IDE tools for symbol search ──

test('SKILL.md Process section exists', () => {
  assert.ok(processSection, 'SKILL.md must contain a "## Process" section');
});

test('SKILL.md Process section mentions jetbrains MCP as preferred for symbol/code search', () => {
  assert.ok(processSection, 'Process section missing');
  assert.match(processSection, /jetbrains/i,
    'SKILL.md Process section must name jetbrains MCP as the preferred tool for symbol lookup');
});

test('SKILL.md Process section puts jetbrains before grep for code-structure questions', () => {
  assert.ok(processSection, 'Process section missing');
  // Must explicitly say to prefer jetbrains over grep/read for symbols
  assert.match(processSection, /prefer.*jetbrains|jetbrains.*prefer|jetbrains.*before.*grep|symbol.*jetbrains/i,
    'SKILL.md must instruct the orchestrator to prefer jetbrains MCP over grep for symbol questions');
});
