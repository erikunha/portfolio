import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { gzipBytes } from '../lib/gzip-size';

const DEFAULT_MAX_CLIENT_KB = '220';
const CHUNKS_DIR = '.next/static/chunks';
const TOP_CHUNK_COUNT = 5;
const BYTES_PER_KB = 1024;
const ROUNDING_FACTOR = 10;
const KB_COLUMN_WIDTH = 7;
const READ_FAILURE_EXIT_CODE = 2;

interface ChunkSize {
  name: string;
  kb: number;
}

const { values } = parseArgs({
  options: {
    'max-client-kb': { type: 'string', default: DEFAULT_MAX_CLIENT_KB },
  },
});

const MAX_CLIENT_KB = Number(values['max-client-kb']);

const gzipKb = (path: string): number =>
  Math.round((gzipBytes(path) / BYTES_PER_KB) * ROUNDING_FACTOR) / ROUNDING_FACTOR;

let failed = false;

console.log(`\nBundle size gate · client chunks: ${MAX_CLIENT_KB}KB\n`);

try {
  const chunks = readdirSync(CHUNKS_DIR).filter((f) => f.endsWith('.js'));
  let clientTotalKb = 0;
  const sizes: ChunkSize[] = [];
  for (const c of chunks) {
    const kb = gzipKb(join(CHUNKS_DIR, c));
    clientTotalKb += kb;
    sizes.push({ name: c, kb });
  }
  const clientRounded = Math.round(clientTotalKb * ROUNDING_FACTOR) / ROUNDING_FACTOR;
  const ok = clientRounded <= MAX_CLIENT_KB;
  console.log(
    `${ok ? 'OK  ' : 'FAIL'}  client chunks total ${clientRounded}KB / ${MAX_CLIENT_KB}KB`,
  );
  if (!ok) failed = true;
  console.log(`\nLargest ${TOP_CHUNK_COUNT} chunks (gzip)`);
  for (const { name, kb } of sizes.sort((a, b) => b.kb - a.kb).slice(0, TOP_CHUNK_COUNT)) {
    console.log(`  ${kb.toFixed(1).padStart(KB_COLUMN_WIDTH)}KB  ${name}`);
  }
} catch (e) {
  console.error(
    'Could not read chunks dir, did the build run?',
    e instanceof Error ? e.message : String(e),
  );
  process.exit(READ_FAILURE_EXIT_CODE);
}

console.log();
process.exit(failed ? 1 : 0);
