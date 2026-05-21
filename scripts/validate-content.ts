/**
 * Build-time Zod content validation. PR 8 of audit roadmap rewrites the
 * previous `validate-content.mjs` that spawned 17 sequential `tsx` child
 * processes (~3.4s of pure Node startup overhead) into a single tsx run
 * that does `await import()` directly. Same per-file pass/fail reporting,
 * fraction of the wall-clock cost.
 *
 * Each `content/*.ts` calls `Schema.parse(...)` at module-evaluation time;
 * importing the file IS the validation. A failed `parse()` throws here and
 * the catch block records it as a failure for the named file.
 *
 * Run via: tsx scripts/validate-content.ts
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CONTENT_FILES = [
  'content/projects.ts',
  'content/employers.ts',
  'content/perf-receipts.ts',
  'content/npm-stack.ts',
  'content/hottest-takes.ts',
  'content/responsibilities.ts',
  'content/guitar-rig.ts',
  'content/unknowns.ts',
  'content/visa.ts',
  'content/credentials.ts',
  'content/community.ts',
  'content/man-page.ts',
  'content/now.ts',
  'content/social.ts',
  'content/git-log.ts',
  'content/sys-health.ts',
  'content/readme.ts',
  'content/ask-eval-corpus.ts',
  // Client-imported content (dmesg, shell-commands) is pure typed data with
  // no Zod runtime to avoid CSP eval violations. Their schemas are validated
  // via the standalone validator below, which is never imported by app code.
  'content/_validate-client-content.ts',
];

const root = path.resolve(process.cwd());
let passed = 0;
let failed = 0;

for (const file of CONTENT_FILES) {
  const absUrl = pathToFileURL(path.join(root, file)).href;
  try {
    await import(absUrl);
    console.log(`  ✓  ${file}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${file}`);
    const message = err instanceof Error ? err.message : String(err);
    console.error(`     ${message.split('\n').slice(0, 3).join('\n     ')}`);
    failed++;
  }
}

console.log(`\ncontent validation: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
