// TDD guard for the jetbrains-mcp-probe SessionStart hook.
// The hook probes a small TCP port range and emits the code-discovery ladder telling the
// orchestrator whether jetbrains MCP is reachable this session (jetbrains-first) or down
// (codebase-memory-first). These tests exec the real bash hook against a fake open port
// (up case) and a guaranteed-closed port (down case).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const hook = join(here, '..', 'hooks', 'jetbrains-mcp-probe');

/** Run the bash hook with the given probe ports; return trimmed stdout. */
function runHook(ports) {
  return execFileSync('bash', [hook], {
    env: { ...process.env, JETBRAINS_MCP_PROBE_PORTS: String(ports), JETBRAINS_MCP_PROBE_HOST: '127.0.0.1' },
    encoding: 'utf8',
  }).trim();
}

/** Start a throwaway TCP listener and return {port, close}. */
function listen() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      resolve({ port: srv.address().port, close: () => new Promise((r) => srv.close(r)) });
    });
  });
}

/** Find a port with no listener (bind then release). Small race, acceptable for a test. */
function closedPort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port;
      srv.close(() => resolve(p));
    });
  });
}

test('probe reports UP when a listener is present on a scanned port', async () => {
  const { port, close } = await listen();
  try {
    const out = runHook(port);
    assert.match(out, /JetBrains MCP up on port/i, 'must report up when the port is open');
    assert.match(out, new RegExp(`port ${port}\\b`), 'must name the open port');
    assert.match(out, /jetbrains -> codebase-memory -> grep/, 'up case must state the jetbrains-first ladder');
  } finally {
    await close();
  }
});

test('probe reports DOWN when no listener is present', async () => {
  const p = await closedPort();
  const out = runHook(p);
  assert.match(out, /JetBrains MCP down/i, 'must report down when the port is closed');
  assert.match(out, /codebase-memory -> grep/, 'down case must fall back to codebase-memory');
  assert.doesNotMatch(out, /up on port/i, 'down case must not claim up');
});

test('probe exits 0 (advisory, never a gate) in both cases', async () => {
  const p = await closedPort();
  // execFileSync throws if exit code is non-zero; reaching here means exit 0.
  assert.doesNotThrow(() => runHook(p));
  const { port, close } = await listen();
  try {
    assert.doesNotThrow(() => runHook(port));
  } finally {
    await close();
  }
});

test('probe picks the first open port when scanning a range', async () => {
  const { port, close } = await listen();
  try {
    const out = runHook(`${port} 65533`);
    assert.match(out, new RegExp(`port ${port}\\b`), 'must select the reachable port in the range');
  } finally {
    await close();
  }
});
