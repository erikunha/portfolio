#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const START_MARKER = '<!-- doc-drift:start -->';
const END_MARKER = '<!-- doc-drift:end -->';

const docPath = resolve(process.argv[2] ?? 'ARCHITECTURE.md');
const baseDir = dirname(docPath);

let source;
try {
  source = readFileSync(docPath, 'utf8');
} catch {
  console.error(`✗ doc-drift: cannot read ${docPath}`);
  process.exit(1);
}

const startIdx = source.indexOf(START_MARKER);
const endIdx = source.indexOf(END_MARKER);
if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
  console.error(
    `✗ doc-drift: missing or malformed marker in ${docPath}.\n` +
      '  Expected the directory tree to be wrapped in:\n' +
      `    ${START_MARKER}\n    \`\`\`\n    …tree…\n    \`\`\`\n    ${END_MARKER}\n` +
      '  Refusing to pass a gate whose input cannot be located.',
  );
  process.exit(1);
}

const region = source.slice(startIdx + START_MARKER.length, endIdx);

function extractPaths(text) {
  const paths = [];
  for (const raw of text.split('\n')) {
    if (/^\s*```/.test(raw)) continue;
    const noComment = raw.replace(/#.*$/, '');
    const trimmed = noComment.trim();
    if (trimmed === '') continue;
    const token = trimmed.split(/\s+/)[0].replace(/[,/]+$/, '');
    if (token === '') continue;
    paths.push(token);
  }
  return paths;
}

const referenced = extractPaths(region);
const stale = referenced.filter((p) => !existsSync(join(baseDir, p)));

if (stale.length === 0) {
  console.log(`✓ doc-drift: ${referenced.length} paths checked, 0 stale`);
  process.exit(0);
}

console.error(
  `✗ doc-drift: ${stale.length} stale path(s) in ${docPath} (referenced, not on disk):`,
);
for (const p of stale) console.error(`  ${p}`);
console.error('  Fix the tree to match the repo, or restore the path. Drift is a CI failure.');
process.exit(1);
