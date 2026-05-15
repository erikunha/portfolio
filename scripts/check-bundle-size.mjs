#!/usr/bin/env node

// Fails the build if any route or shared client chunk exceeds gzipped budgets.
// Reads .next/build-manifest.json and .next/static/chunks/ sizes.
//
// NOTE: With Turbopack, React 19 + Next.js 15 runtime (~185KB gzipped) is co-bundled
// with application code into the same chunks. The --max-client-kb threshold covers
// the full bundle (framework + app). Use @next/bundle-analyzer to measure app-only
// islands (~43KB budget, tracked separately via CLAUDE.md).
//
// Usage: node scripts/check-bundle-size.mjs --max-route-kb=120 --max-client-kb=320

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';

const { values } = parseArgs({
  options: {
    'max-route-kb': { type: 'string', default: '120' },
    'max-client-kb': { type: 'string', default: '320' },
  },
});

const MAX_ROUTE_KB = Number(values['max-route-kb']);
const MAX_CLIENT_KB = Number(values['max-client-kb']);
const CHUNKS_DIR = '.next/static/chunks';
const MANIFEST = '.next/build-manifest.json';

function gzipKb(path) {
  const buf = readFileSync(path);
  return Math.round((gzipSync(buf).length / 1024) * 10) / 10;
}

let failed = false;

console.log(`\nBundle size gate · route: ${MAX_ROUTE_KB}KB · client: ${MAX_CLIENT_KB}KB\n`);

try {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  for (const [route, files] of Object.entries(manifest.pages ?? {})) {
    if (!Array.isArray(files)) continue;
    let totalKb = 0;
    for (const f of files) {
      const fullPath = join('.next', f);
      if (existsSync(fullPath)) totalKb += gzipKb(fullPath);
    }
    const totalRounded = Math.round(totalKb * 10) / 10;
    const ok = totalRounded <= MAX_ROUTE_KB;
    console.log(
      `${ok ? 'OK  ' : 'FAIL'}  route ${route.padEnd(30)} ${totalRounded}KB / ${MAX_ROUTE_KB}KB`,
    );
    if (!ok) failed = true;
  }
} catch (e) {
  console.error('Could not read .next/build-manifest.json — did the build run?', e.message);
  process.exit(2);
}

try {
  const chunks = readdirSync(CHUNKS_DIR).filter((f) => f.endsWith('.js'));
  let clientTotalKb = 0;
  for (const c of chunks) {
    clientTotalKb += gzipKb(join(CHUNKS_DIR, c));
  }
  const clientRounded = Math.round(clientTotalKb * 10) / 10;
  const ok = clientRounded <= MAX_CLIENT_KB;
  console.log(
    `\n${ok ? 'OK  ' : 'FAIL'}  client chunks total ${clientRounded}KB / ${MAX_CLIENT_KB}KB`,
  );
  if (!ok) failed = true;
} catch (e) {
  console.error('Could not read chunks dir', e.message);
}

console.log();
process.exit(failed ? 1 : 0);
