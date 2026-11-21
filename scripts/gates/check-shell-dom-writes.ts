import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFiles } from '../lib/walk.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SHELL_DIR = 'components/client/InteractiveShell';
const SOURCE_FILE = /\.(ts|tsx)$/;
const TEST_FILE = /\.(test|e2e)\.(ts|tsx)$/;
const FAILURE_EXIT_CODE = 1;

const REF_WRITING_PLACEHOLDER_TYPEWRITER: ReadonlySet<string> = new Set([
  `${SHELL_DIR}/AnimatedPlaceholder.client.tsx`,
]);

const DOM_WRITE_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['document.createElement', /\bdocument\s*\.\s*createElement\b/],
  ['appendChild', /\.\s*appendChild\s*\(/],
  ['insertAdjacentHTML', /\.\s*insertAdjacentHTML\s*\(/],
  ['textContent assignment', /\.\s*textContent\s*(?:[-+*/%|&^]|\|\||&&|\?\?)?=(?!=)/],
  ['innerHTML assignment', /\.\s*innerHTML\s*(?:[-+*/%|&^]|\|\||&&|\?\?)?=(?!=)/],
];

const violations: string[] = [];
const shellRoot = path.join(ROOT, SHELL_DIR);
for (const file of listFiles(shellRoot, { include: SOURCE_FILE })) {
  if (TEST_FILE.test(file)) continue;
  const rel = `${SHELL_DIR}/${file.replace(/\\/g, '/')}`;
  if (REF_WRITING_PLACEHOLDER_TYPEWRITER.has(rel)) continue;
  const lines = readFileSync(path.join(shellRoot, file), 'utf-8').split('\n');
  lines.forEach((line, index) => {
    for (const [name, pattern] of DOM_WRITE_PATTERNS) {
      if (pattern.test(line)) violations.push(`${rel}:${index + 1}: ${name}`);
    }
  });
}

if (violations.length === 0) {
  console.log('✓ shell-dom-writes: 0 violations, the shell renders only through React');
  process.exit(0);
}

console.error(
  `✗ shell-dom-writes: ${violations.length} violation${violations.length === 1 ? '' : 's'}:`,
);
for (const v of violations) console.error(`  ${v}`);
console.error(
  `  ${SHELL_DIR} renders through React state; imperative DOM writes bypass the streamed-answer render path.`,
);
process.exit(FAILURE_EXIT_CODE);
