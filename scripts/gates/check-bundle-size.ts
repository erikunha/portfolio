import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { gzipBytes } from '../lib/gzip-size';

const DEFAULT_MAX_CLIENT_KB = '220';
const CHUNKS_DIR = '.next/static/chunks';
const TOP_CHUNK_COUNT = 5;
const BYTES_PER_KB = 1024;
const KB_COLUMN_WIDTH = 7;
const KB_DECIMALS = 1;
const READ_FAILURE_EXIT_CODE = 2;

interface ChunkSize {
  name: string;
  bytes: number;
}

const { values } = parseArgs({
  options: {
    'max-client-kb': { type: 'string', default: DEFAULT_MAX_CLIENT_KB },
  },
});

const MAX_CLIENT_KB = Number(values['max-client-kb']);
const MAX_CLIENT_BYTES = MAX_CLIENT_KB * BYTES_PER_KB;

const formatBytes = (bytes: number): string => `${bytes.toLocaleString('en-US')} B`;
const formatKb = (bytes: number): string => (bytes / BYTES_PER_KB).toFixed(KB_DECIMALS);

let failed = false;

console.log(`\nBundle size gate · client chunks: ${MAX_CLIENT_KB}KB\n`);

try {
  const chunks = readdirSync(CHUNKS_DIR).filter((f) => f.endsWith('.js'));
  if (chunks.length === 0) {
    console.error(`No client chunks in ${CHUNKS_DIR}, did the build run?`);
    process.exit(READ_FAILURE_EXIT_CODE);
  }
  const sizes: ChunkSize[] = chunks.map((name) => ({
    name,
    bytes: gzipBytes(join(CHUNKS_DIR, name)),
  }));
  const totalBytes = sizes.reduce((sum, { bytes }) => sum + bytes, 0);
  const ok = totalBytes <= MAX_CLIENT_BYTES;
  console.log(
    `${ok ? 'OK  ' : 'FAIL'}  client chunks total ${formatBytes(totalBytes)} (${formatKb(totalBytes)}KB) / ${formatBytes(MAX_CLIENT_BYTES)} (${MAX_CLIENT_KB}KB)`,
  );
  if (!ok) failed = true;
  console.log(`\nLargest ${TOP_CHUNK_COUNT} chunks (gzip)`);
  for (const { name, bytes } of sizes.sort((a, b) => b.bytes - a.bytes).slice(0, TOP_CHUNK_COUNT)) {
    console.log(`  ${formatKb(bytes).padStart(KB_COLUMN_WIDTH)}KB  ${name}`);
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
