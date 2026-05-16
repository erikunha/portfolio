/**
 * Build-time Zod content validation.
 * Runs: node scripts/validate-content.mjs
 * Fails the build if any content file doesn't parse.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';

// We need tsx/ts-node to run TS content files. Use the compiled output if available,
// otherwise rely on the build step having already type-checked. This script is a
// smoke-test that the content modules are importable — the real validation happens
// inside each content/*.ts file via Zod .parse() calls at module load time.

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
  'content/shell-commands.ts',
  'content/readme.ts',
  'content/dmesg.ts',
];

const root = path.resolve(process.cwd());

let passed = 0;
let failed = 0;

// Use tsx to execute a quick import check via child_process
import { spawnSync } from 'node:child_process';

for (const file of CONTENT_FILES) {
  const absPath = path.join(root, file);
  const result = spawnSync(process.execPath, ['--import', 'tsx/esm', '--input-type=module'], {
    input: `import '${pathToFileURL(absPath).href}'; console.log('ok');`,
    encoding: 'utf8',
    timeout: 10000,
  });

  const ok = result.status === 0 && result.stdout.includes('ok');
  if (ok) {
    console.log(`  ✓  ${file}`);
    passed++;
  } else {
    console.error(`  ✗  ${file}`);
    if (result.stderr) console.error(result.stderr.trim());
    failed++;
  }
}

console.log(`\ncontent validation: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
