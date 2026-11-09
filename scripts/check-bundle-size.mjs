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
