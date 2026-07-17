import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = join(process.cwd(), 'scripts/check-route-js.mjs');
const MANIFEST_REL = '.next/diagnostics/route-bundle-stats.json';
const CHUNK_DIR_REL = '.next/static/chunks';

let dir;

const run = () => spawnSync('node', [SCRIPT], { cwd: dir, encoding: 'utf8' });

// A chunk whose GZIPPED size is `kb`. Incompressible bytes, so gzip cannot shrink them below
// the payload — the gate measures gzipped bytes, and random data is the only way a fixture
// can pin that number instead of hoping the compressor cooperates.
function writeChunk(name, kb) {
  const target = kb * 1024;
  let body = Buffer.alloc(0);
  while (gzipSync(body).length < target) {
    body = Buffer.concat([
      body,
      Buffer.from(Array.from({ length: 4096 }, () => Math.floor(Math.random() * 256))),
    ]);
  }
  const rel = `${CHUNK_DIR_REL}/${name}`;
  writeFileSync(join(dir, rel), body);
  return rel;
}

function writeManifest(rows) {
  writeFileSync(join(dir, MANIFEST_REL), JSON.stringify(rows));
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'route-js-'));
  mkdirSync(join(dir, '.next/diagnostics'), { recursive: true });
  mkdirSync(join(dir, CHUNK_DIR_REL), { recursive: true });
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('check-route-js.mjs', () => {
  it('fails when the manifest is absent — a missing build must never read as a pass', () => {
    rmSync(join(dir, MANIFEST_REL), { force: true });
    const res = run();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/does not exist/i);
  });

  it('fails when the manifest lists no routes', () => {
    writeManifest([]);
    const res = run();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/no routes/i);
  });

  it('fails when the manifest names a chunk that is not on disk', () => {
    writeManifest([{ route: '/', firstLoadChunkPaths: ['.next/static/chunks/ghost.js'] }]);
    const res = run();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/not on disk/i);
  });

  it('passes a single route whose app-owned JS is inside the budget', () => {
    const framework = writeChunk('framework.js', 143);
    const app = writeChunk('app.js', 10);
    writeManifest([{ route: '/', firstLoadChunkPaths: [framework, app] }]);
    const res = run();
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('fails a SINGLE route that busts the app-owned budget — the intersection definition reported 0.0 KB and OK here', () => {
    const framework = writeChunk('framework.js', 143);
    const island = writeChunk('island.js', 50);
    writeManifest([{ route: '/', firstLoadChunkPaths: [framework, island] }]);
    const res = run();
    expect(
      res.status,
      'with one route, defining framework as "chunks every route shares" makes the whole bundle framework, app-owned computes to 0, and the gate prints OK over an unmeasured budget. App-owned must be measured against the framework floor constant, not against sibling routes.',
    ).not.toBe(0);
    expect(res.stderr).toMatch(/app-owned JS/i);
  });

  it('counts a chunk shared by EVERY route as app-owned, not framework', () => {
    const framework = writeChunk('framework.js', 143);
    const layoutIsland = writeChunk('layout-island.js', 50);
    writeManifest([
      { route: '/', firstLoadChunkPaths: [framework, layoutIsland] },
      { route: '/other', firstLoadChunkPaths: [framework, layoutIsland] },
    ]);
    const res = run();
    expect(
      res.status,
      'a client island moved into app/layout.tsx lands on every route. Classifying "on every route" as framework would exempt it from the app-owned budget — the exact code the budget exists to constrain.',
    ).not.toBe(0);
    expect(res.stderr).toMatch(/app-owned JS/i);
  });

  it('fails loudly when the framework-floor constant is stale rather than inflating app-owned', () => {
    const tiny = writeChunk('tiny.js', 20);
    writeManifest([{ route: '/', firstLoadChunkPaths: [tiny] }]);
    const res = run();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/stale/i);
  });

  it('fails a route over the total budget', () => {
    const framework = writeChunk('framework.js', 143);
    const heavy = writeChunk('heavy.js', 40);
    writeManifest([{ route: '/', firstLoadChunkPaths: [framework, heavy] }]);
    const res = run();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/over the 175 KB budget/i);
  });
});
