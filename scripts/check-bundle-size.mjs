#!/usr/bin/env node

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
const TOP_CHUNK_COUNT = 5;

function gzipKb(path) {
  const buf = readFileSync(path);
  return Math.round((gzipSync(buf).length / 1024) * 10) / 10;
}

let failed = false;

console.log(`\nBundle size gate · client chunks: ${MAX_CLIENT_KB}KB\n`);

try {
  const chunks = readdirSync(CHUNKS_DIR).filter((f) => f.endsWith('.js'));
  let clientTotalKb = 0;
  const sizes = [];
  for (const c of chunks) {
    const kb = gzipKb(join(CHUNKS_DIR, c));
    clientTotalKb += kb;
    sizes.push({ name: c, kb });
  }
  const clientRounded = Math.round(clientTotalKb * 10) / 10;
  const ok = clientRounded <= MAX_CLIENT_KB;
  console.log(
    `${ok ? 'OK  ' : 'FAIL'}  client chunks total ${clientRounded}KB / ${MAX_CLIENT_KB}KB`,
  );
  if (!ok) failed = true;
  console.log(`\nLargest ${TOP_CHUNK_COUNT} chunks (gzip)`);
  for (const { name, kb } of sizes.sort((a, b) => b.kb - a.kb).slice(0, TOP_CHUNK_COUNT)) {
    console.log(`  ${kb.toFixed(1).padStart(7)}KB  ${name}`);
  }
} catch (e) {
  console.error('Could not read chunks dir, did the build run?', e.message);
  process.exit(2);
}

console.log();
process.exit(failed ? 1 : 0);
