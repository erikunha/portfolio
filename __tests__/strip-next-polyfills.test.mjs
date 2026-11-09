import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts/strip-next-polyfills.mjs');
const POLYFILL_DIR = 'node_modules/next/dist/build/polyfills';
const MODULE_REL = `${POLYFILL_DIR}/polyfill-module.js`;
const NOMODULE_REL = `${POLYFILL_DIR}/polyfill-nomodule.js`;
const SENTINEL = '// Stripped by scripts/strip-next-polyfills.mjs';
const REAL_SHAPED = `Object.defineProperty(globalThis,'x',{});\n${'a'.repeat(1500)}`;

let dir;

function run() {
  return spawnSync('node', [SCRIPT], { cwd: dir, encoding: 'utf8' });
}
function writeFile(rel, content) {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
  return full;
}
function writeBoth(content) {
  return [writeFile(MODULE_REL, content), writeFile(NOMODULE_REL, content)];
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'strip-polyfills-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('strip-next-polyfills.mjs — hardened postinstall', () => {
  it('exits non-zero when the targets are absent (no more silent no-op)', () => {
    const res = run();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/not found/i);
  });

  it('exits non-zero when a target is present but too small (wrong shape)', () => {
    writeBoth('export {};\n');
    const res = run();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/unexpected shape/i);
  });

  it('exits non-zero when a large target lacks the known polyfill token', () => {
    writeBoth(`/* not a polyfill bundle */\n${'x'.repeat(2000)}`);
    const res = run();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/unexpected shape/i);
  });

  it('strips BOTH bundles (exit 0 + sentinel written to each)', () => {
    const [mod, nomod] = writeBoth(REAL_SHAPED);
    const res = run();
    expect(res.status).toBe(0);
    expect(readFileSync(mod, 'utf8').startsWith(SENTINEL)).toBe(true);
    expect(
      readFileSync(nomod, 'utf8').startsWith(SENTINEL),
      'polyfill-nomodule.js is byte-identical to polyfill-module.js (~112KB) and ships as a real chunk. Modern browsers never fetch it (the tag carries noModule, and every browser in this repo browserslist has supported ES modules since ~2017), but check-bundle-size.mjs sums the chunks directory blindly, so leaving it unstripped inflates that gate by ~38KB of bytes no supported user ever downloads.',
    ).toBe(true);
  });

  it('requires the nomodule bundle, not just the module one', () => {
    writeFile(MODULE_REL, REAL_SHAPED);
    const res = run();
    expect(
      res.status,
      'the script must fail when polyfill-nomodule.js is missing — stripping only polyfill-module.js is the exact defect this target list exists to close',
    ).not.toBe(0);
    expect(res.stderr).toMatch(/polyfill-nomodule\.js not found/i);
  });

  it('is idempotent: already-stripped (tiny) files exit 0 without rewriting', () => {
    const stripped = `${SENTINEL} — modern browsers only\n`;
    const [mod, nomod] = writeBoth(stripped);
    const res = run();
    expect(res.status).toBe(0);
    expect(readFileSync(mod, 'utf8')).toBe(stripped);
    expect(readFileSync(nomod, 'utf8')).toBe(stripped);
  });
});
