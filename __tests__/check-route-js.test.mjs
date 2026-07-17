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

  it('fails a SINGLE route that busts the budget — the intersection definition reported 0.0 KB and OK here', () => {
    const framework = writeChunk('framework.js', 143);
    const island = writeChunk('island.js', 50);
    writeManifest([{ route: '/', firstLoadChunkPaths: [framework, island] }]);
    const res = run();
    expect(
      res.status,
      'with one route, defining framework as "chunks every route shares" makes the whole bundle framework, app-owned computes to 0, and the gate prints OK over an unmeasured budget. The floor must be a measured constant, not an intersection of sibling routes.',
    ).not.toBe(0);
    expect(res.stderr).toMatch(/over the 175 KB budget/i);
    expect(
      res.stderr,
      'a failure must name the app-owned share, since that is the part the reader can act on',
    ).toMatch(/app-owned/i);
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
      'a client island moved into app/layout.tsx lands on every route. Classifying "on every route" as framework would exempt it from the budget — the exact code the budget exists to constrain.',
    ).not.toBe(0);
    expect(res.stderr).toMatch(/over the 175 KB budget/i);
  });

  it('fails a route in the 175-185.2 KB band, where the retired app-owned threshold would not have fired', () => {
    const framework = writeChunk('framework.js', 143);
    const app = writeChunk('app.js', 37);
    writeManifest([{ route: '/', firstLoadChunkPaths: [framework, app] }]);
    const res = run();
    expect(
      res.status,
      'This fixture measures 184.1 KB total / 41.9 KB app-owned (the chunk writer rounds gzipped size up to the next 4 KB, so the nominal 143+37 lands higher). That is inside the disagreement band 175 < total < 185.2 and UNDER the retired 43 KB app-owned threshold, yet the route must still fail on the 175 KB total. NOTE what this does and does not hold: it pins that the band fails, so relaxing the total to 185 to "restore" the two-gate design breaks here. It does NOT prove a second app-owned threshold is absent — re-adding `|| appOwned > 43` leaves this exit code and stderr byte-identical, because app-owned = total - 142.2 makes that branch unreachable dead code for every input. Absence of dead code is not behaviorally testable; see DECISIONS.md 2026-07-14.',
    ).not.toBe(0);
    expect(res.stderr).toMatch(/over the 175 KB budget/i);
  });

  it('fails loudly when the framework-floor constant is stale rather than inflating app-owned', () => {
    const tiny = writeChunk('tiny.js', 20);
    writeManifest([{ route: '/', firstLoadChunkPaths: [tiny] }]);
    const res = run();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/stale/i);
    expect(
      res.stderr,
      'The stale-floor message must quote the derived headroom (175 - 142.2 = 32.8), not a hardcoded budget. This assertion exists because the message outlived the gate it described: it kept telling the reader to re-measure against a "43 KB budget" for a whole review cycle after that threshold was deleted, and the /stale/i match above sailed straight over it.',
    ).toMatch(/32\.8 KB of app-owned headroom/);
    expect(res.stderr).not.toMatch(/43 KB/);
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
