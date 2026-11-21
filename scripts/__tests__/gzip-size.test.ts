import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { gzipBytes } from '../lib/gzip-size';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'gzip-size-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('gzipBytes', () => {
  it('returns the gzipped byte length of the file, not its raw length', () => {
    const body = 'a'.repeat(10_000);
    const file = join(dir, 'chunk.js');
    writeFileSync(file, body);
    const size = gzipBytes(file);
    expect(size).toBe(gzipSync(Buffer.from(body)).length);
    expect(size).toBeLessThan(body.length);
  });

  it('throws when the file does not exist', () => {
    expect(() => gzipBytes(join(dir, 'missing.js'))).toThrow(/ENOENT/);
  });
});
