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
  'content/hero.ts',
  'content/seo.ts',
  'content/daw-mixer.ts',
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
