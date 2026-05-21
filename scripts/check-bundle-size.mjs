#!/usr/bin/env node

// Fails the build if the total client-chunk gzipped size exceeds the budget.
//
// --max-client-kb : the FULL client-chunk total (gzipped). Under Next 16 +
//                   Turbopack the Next/React framework (~185KB) is co-bundled
//                   with application code into the same chunks, so this number
//                   is framework-inclusive. It is the only honest measurement
//                   this script can produce.
//
// Per-route First Load JS is intentionally NOT gated here: it is not
// extractable from the Turbopack manifest. `.next/build-manifest.json`'s
// `pages` map carries only the legacy empty `/_app: []` shape, there is no
// `app-build-manifest.json`, and `app-path-routes-manifest.json` has no chunk
// lists — a per-route check would silently measure /_app at 0KB.
//
// The 43KB app-island figure (client JS excluding framework bootstrap) is a
// design target tracked via `pnpm bundle:analyze`, not gated here.
//
// Usage: node scripts/check-bundle-size.mjs --max-client-kb=220

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';

const { values } = parseArgs({
  options: {
    'max-client-kb': { type: 'string', default: '220' },
  },
});

const MAX_CLIENT_KB = Number(values['max-client-kb']);
const CHUNKS_DIR = '.next/static/chunks';

function gzipKb(path) {
  const buf = readFileSync(path);
  return Math.round((gzipSync(buf).length / 1024) * 10) / 10;
}

let failed = false;

console.log(`\nBundle size gate · client chunks: ${MAX_CLIENT_KB}KB\n`);

try {
  const chunks = readdirSync(CHUNKS_DIR).filter((f) => f.endsWith('.js'));
  let clientTotalKb = 0;
  for (const c of chunks) {
    clientTotalKb += gzipKb(join(CHUNKS_DIR, c));
  }
  const clientRounded = Math.round(clientTotalKb * 10) / 10;
  const ok = clientRounded <= MAX_CLIENT_KB;
  console.log(
    `${ok ? 'OK  ' : 'FAIL'}  client chunks total ${clientRounded}KB / ${MAX_CLIENT_KB}KB`,
  );
  if (!ok) failed = true;
} catch (e) {
  console.error('Could not read chunks dir — did the build run?', e.message);
  process.exit(2);
}

console.log();
process.exit(failed ? 1 : 0);
