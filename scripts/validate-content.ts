import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { listContentFiles } from './content-files.mjs';

const MIN_EXPECTED_CONTENT_FILES = 20;

const files = listContentFiles();

if (files.length < MIN_EXPECTED_CONTENT_FILES) {
  console.error(
    `content validation: found only ${files.length} content modules, expected at least ${MIN_EXPECTED_CONTENT_FILES}.\n` +
      'The glob has resolved to (almost) nothing, which means it is no longer looking where the content lives.\n' +
      'A gate that validates zero files prints "0 passed, 0 failed" and exits 0 — the fail-open the hand-listed\n' +
      'CONTENT_FILES array produced, rebuilt in a new shape. Refusing to pass.',
  );
  process.exit(1);
}

let passed = 0;
let failed = 0;

for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  try {
    await import(pathToFileURL(file).href);
    console.log(`  ✓  ${rel}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${rel}`);
    const message = err instanceof Error ? err.message : String(err);
    console.error(`     ${message.split('\n').slice(0, 3).join('\n     ')}`);
    failed++;
  }
}

console.log(`\ncontent validation: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
