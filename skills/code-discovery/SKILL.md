---
name: code-discovery
description: Use when locating code — finding a symbol, class, function, route, or constant; going to a definition; finding references or call graphs; or searching code structure in any repo. Establishes the strict tool ladder jetbrains MCP (live IDE index) → codebase-memory-mcp → raw Grep/Read/Glob, so symbol lookups use the IDE index instead of text grep. Pairs with the jetbrains-mcp-probe SessionStart hook.
---

# Code discovery — the jetbrains-first ladder

For any code-structure question (where is X defined, what calls Y, all uses of Z, type/docs of a symbol),
use the tools in this strict priority order. **Try in order; fall back only on tool failure or unavailability.**
The `jetbrains-mcp-probe` SessionStart hook reports whether jetbrains MCP is reachable this session — if it says
down, start at step 2.

## The ladder

1. **`jetbrains` MCP — always try first** for any code-structure question. It is the **live PyCharm IDE index**,
   not text grep. Always pass `projectPath`. If a call errors or the MCP is unavailable → fall back to 2.
   - `search_symbol` — semantic lookup by name fragment (`include_external=true` for SDK/library symbols).
   - `search_in_files_by_text` / `search_in_files_by_regex` — text/regex within the project.
   - `get_symbol_info` — type + docs + declaration at `line:col`.
   - `get_file_problems` — IDE inspections for a file.
   - `rename_refactoring` — safe rename across all references.
   - `read_file` — reads into JARs, decompiles `.class`.
   - `find_files_by_name_keyword`, `execute_terminal_command` — file lookup / IDE terminal.
   - Endpoint: PyCharm 2025.2+ ships the built-in MCP server (`com.intellij.mcpServer`) over SSE at
     `http://localhost:64342/sse`; the port can shift if 64342 is busy (see the probe hook).

2. **`codebase-memory-mcp` — fallback when jetbrains is down.** Check `index_status` first; run
   `index_repository` if stale.
   - `search_graph`, `get_code_snippet`, `trace_path`, `search_code`, `get_architecture`, `query_graph`.

3. **Raw `Grep` / `Read` / `Glob` — last resort only** when both MCP servers fail, or for non-code files
   (config, YAML, text, markdown). **Never reach for Grep to look up a symbol or find references if jetbrains
   is reachable.**

## Notes

- Two SessionStart hooks touch code discovery. The MCP-installed `cbm-session-reminder` says
  "codebase-memory FIRST"; this skill and `jetbrains-mcp-probe` are authoritative: **jetbrains → codebase-memory
  → grep**. Prefer jetbrains for symbols when it is up.
- If the `cbm-code-discovery-gate` PreToolUse hook blocks a Read/Grep/Glob, switch to the suggested CBM tool or
  simply retry (the hook is one-shot per session). Don't give up; don't ask whether to retry.
- `ide` (built-in) `mcp__ide__getDiagnostics` gives LSP/type diagnostics for open files.
