# Hooks — install snippet

## `jetbrains-mcp-probe` (SessionStart)

Probes JetBrains MCP reachability and injects the authoritative code-discovery ladder into session
context. Pairs with the `code-discovery` skill.

**Install:**

1. Copy `hooks/jetbrains-mcp-probe` to `~/.claude/hooks/jetbrains-mcp-probe` and make it executable
   (`chmod +x`).
2. Add this to `~/.claude/settings.json` under `hooks.SessionStart` (alongside the existing
   `cbm-session-reminder` entries — both may run; the probe is authoritative on jetbrains-first order):

```json
{
  "hooks": {
    "SessionStart": [
      { "matcher": "startup", "hooks": [{ "type": "command", "command": "~/.claude/hooks/jetbrains-mcp-probe" }] },
      { "matcher": "resume",  "hooks": [{ "type": "command", "command": "~/.claude/hooks/jetbrains-mcp-probe" }] },
      { "matcher": "clear",   "hooks": [{ "type": "command", "command": "~/.claude/hooks/jetbrains-mcp-probe" }] },
      { "matcher": "compact", "hooks": [{ "type": "command", "command": "~/.claude/hooks/jetbrains-mcp-probe" }] }
    ]
  }
}
```

**Overrides:** `JETBRAINS_MCP_PROBE_PORTS` (default `64342 64343 64344 64345`),
`JETBRAINS_MCP_PROBE_HOST` (default `127.0.0.1`).
