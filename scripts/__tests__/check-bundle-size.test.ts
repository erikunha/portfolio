import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SUBPROCESS_TEST_TIMEOUT_MS = 60_000;
const SCRIPT = join(process.cwd(), 'scripts/gates/check-bundle-size.ts');
const TSX = join(process.cwd(), 'node_modules/.bin/tsx');
const CHUNK_DIR_REL = '.next/static/chunks';
const BYTES_PER_KB = 1024;
const SIZE_SEARCH_LIMIT = 200;
const EMPTY_DIR_EXIT_CODE = 2;

let dir: string;

const run = (maxKb: number) =>
  spawnSync(TSX, [SCRIPT, '--max-client-kb', String(maxKb)], { cwd: dir, encoding: 'utf8' });

function bodyWithGzipBytes(target: number): Buffer {
  let length = target;
  for (let attempt = 0; attempt < SIZE_SEARCH_LIMIT; attempt++) {
    const body = randomBytes(length);
    const actual = gzipSync(body).length;
    if (actual === target) return body;
    length += target - actual;
  }
  throw new Error(`no body with ${target} gzip bytes`);
}

function writeChunk(name: string, gzipTarget: number, body = bodyWithGzipBytes(gzipTarget)) {
  writeFileSync(join(dir, CHUNK_DIR_REL, name), body);
  return body;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bundle-size-'));
  mkdirSync(join(dir, CHUNK_DIR_REL), { recursive: true });
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('check-bundle-size.ts', { timeout: SUBPROCESS_TEST_TIMEOUT_MS }, () => {
  it('passes when the exact gzip total is inside the cap and prints the exact bytes', () => {
    writeChunk('a.js', 1500);
    writeChunk('b.js', 1000);
    const res = run(3);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('2,500 B');
  });

  it('fails when a lazily loaded chunk pushes the total over the cap', () => {
    writeChunk('first-load.js', 2500);
    expect(run(4).status).toBe(0);
    writeChunk('lazy.js', 2000);
    const res = run(4);
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('FAIL');
  });

  it('counts identical copies of one chunk twice', () => {
    const body = writeChunk('copy-a.js', 2500);
    expect(run(4).status).toBe(0);
    writeChunk('copy-b.js', 2500, body);
    expect(run(4).status).toBe(1);
  });

  it('fails a total over the cap that per-chunk rounding to 0.1 KB would read as under it', () => {
    for (const name of ['a.js', 'b.js', 'c.js']) writeChunk(name, 342);
    const exact = 3 * 342;
    expect(exact).toBeGreaterThan(BYTES_PER_KB);
    expect(run(1).status).toBe(1);
  });

  it('passes a total under the cap that per-chunk rounding to 0.1 KB would read as over it', () => {
    for (const name of ['a.js', 'b.js', 'c.js', 'd.js', 'e.js']) writeChunk(name, 359);
    const exact = 5 * 359;
    expect(exact).toBeLessThan(1.8 * BYTES_PER_KB);
    expect(run(1.8).status).toBe(0);
  });

  it('exits 2 when the chunk directory holds no chunk: an empty build must not read as a pass', () => {
    const res = run(220);
    expect(res.status).toBe(EMPTY_DIR_EXIT_CODE);
    expect(res.stderr).toMatch(/no client chunks/i);
  });

  it('exits 2 when the chunk directory is missing', () => {
    rmSync(join(dir, '.next'), { recursive: true, force: true });
    const res = run(220);
    expect(res.status).toBe(EMPTY_DIR_EXIT_CODE);
    expect(res.stderr).toMatch(/did the build run/i);
  });

  it('ignores files that are not scripts', () => {
    writeChunk('a.js', 1000);
    writeFileSync(join(dir, CHUNK_DIR_REL, 'a.js.map'), randomBytes(5000));
    expect(run(2).status).toBe(0);
  });
});
