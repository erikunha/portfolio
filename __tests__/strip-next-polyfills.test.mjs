// __tests__/strip-next-polyfills.test.mjs
// WS1: the polyfill-strip postinstall must FAIL LOUDLY when its target is
// missing or unexpectedly shaped (a silent no-op let the Lighthouse Best-
// Practices penalty silently return after a Next reorg), and must be
// idempotent on re-install (the stripped file is tiny — the idempotency check
// has to run BEFORE the size/shape assert, or a second install throws).

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts/strip-next-polyfills.mjs');
const TARGET_REL = 'node_modules/next/dist/build/polyfills/polyfill-module.js';
const SENTINEL = '// Stripped by scripts/strip-next-polyfills.mjs';

let dir;

function run() {
  return spawnSync('node', [SCRIPT], { cwd: dir, encoding: 'utf8' });
}
function writeTarget(content) {
  const full = join(dir, TARGET_REL);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
  return full;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'strip-polyfills-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('strip-next-polyfills.mjs — hardened postinstall', () => {
  it('exits non-zero when the target is absent (no more silent no-op)', () => {
    const res = run();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/not found/i);
  });

  it('exits non-zero when the target is present but too small (wrong shape)', () => {
    writeTarget('export {};\n');
    const res = run();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/unexpected shape/i);
  });

  it('exits non-zero when a large target lacks the known polyfill token', () => {
    writeTarget(`/* not a polyfill bundle */\n${'x'.repeat(2000)}`);
    const res = run();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/unexpected shape/i);
  });

  it('strips a valid, real-shaped polyfill bundle (exit 0 + sentinel written)', () => {
    const full = writeTarget(`Object.defineProperty(globalThis,'x',{});\n${'a'.repeat(1500)}`);
    const res = run();
    expect(res.status).toBe(0);
    expect(readFileSync(full, 'utf8').startsWith(SENTINEL)).toBe(true);
  });

  it('is idempotent: an already-stripped (tiny) file exits 0 without rewriting', () => {
    const stripped = `${SENTINEL} — modern browsers only\n`;
    const full = writeTarget(stripped);
    const res = run();
    expect(res.status).toBe(0);
    // Unchanged — the idempotency check ran before the size assert.
    expect(readFileSync(full, 'utf8')).toBe(stripped);
  });
});
