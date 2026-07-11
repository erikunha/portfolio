import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = resolve('node_modules/next/dist/build/polyfills/polyfill-module.js');

const SENTINEL = '// Stripped by scripts/strip-next-polyfills.mjs';
const MIN_SIZE_BYTES = 1024;
const KNOWN_TOKEN = 'Object.defineProperty';

if (!existsSync(target)) {
  console.error(
    `[strip-polyfills] polyfill-module.js not found at ${target}. ` +
      'Next.js may have reorganized the polyfill path — re-check the target ' +
      'before relying on the Lighthouse Best-Practices score.',
  );
  process.exit(1);
}

const current = readFileSync(target, 'utf8');

if (current.startsWith(SENTINEL)) {
  console.log('[strip-polyfills] already stripped — skipping');
  process.exit(0);
}

const sizeBytes = Buffer.byteLength(current, 'utf8');
if (sizeBytes < MIN_SIZE_BYTES || !current.includes(KNOWN_TOKEN)) {
  console.error(
    `[strip-polyfills] unexpected shape at ${target} ` +
      `(size ${sizeBytes}B, token "${KNOWN_TOKEN}" ${
        current.includes(KNOWN_TOKEN) ? 'present' : 'absent'
      }). Next.js likely changed the polyfill bundle — re-verify before stripping.`,
  );
  process.exit(1);
}

writeFileSync(target, `${SENTINEL} — modern browsers only\n`, 'utf8');
console.log('[strip-polyfills] Next.js polyfill bundle cleared');
