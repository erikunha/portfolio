import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const START_MARKER = '<!-- doc-drift:start -->';
const END_MARKER = '<!-- doc-drift:end -->';
const DEFAULT_DOC_PATH = 'ARCHITECTURE.md';
const DOC_ARG_INDEX = 2;
const FAILURE_EXIT_CODE = 1;
const NOT_FOUND = -1;

const docPath = resolve(process.argv[DOC_ARG_INDEX] ?? DEFAULT_DOC_PATH);
const baseDir = dirname(docPath);

let source: string;
try {
  source = readFileSync(docPath, 'utf8');
} catch {
  console.error(`✗ doc-drift: cannot read ${docPath}`);
  process.exit(FAILURE_EXIT_CODE);
}

const startIdx = source.indexOf(START_MARKER);
const endIdx = source.indexOf(END_MARKER);
if (startIdx === NOT_FOUND || endIdx === NOT_FOUND || endIdx < startIdx) {
  console.error(
    `✗ doc-drift: missing or malformed marker in ${docPath}.\n` +
      '  Expected the directory tree to be wrapped in:\n' +
      `    ${START_MARKER}\n    \`\`\`\n    …tree…\n    \`\`\`\n    ${END_MARKER}\n` +
      '  Refusing to pass a gate whose input cannot be located.',
  );
  process.exit(FAILURE_EXIT_CODE);
}

const region = source.slice(startIdx + START_MARKER.length, endIdx);

function extractPaths(text: string): string[] {
  const paths: string[] = [];
  for (const raw of text.split('\n')) {
    if (/^\s*```/.test(raw)) continue;
    const noComment = raw.replace(/#.*$/, '');
    const trimmed = noComment.trim();
    if (trimmed === '') continue;
    const token = (trimmed.split(/\s+/)[0] ?? '').replace(/[,/]+$/, '');
    if (token === '') continue;
    paths.push(token);
  }
  return paths;
}

const referenced = extractPaths(region);
const stale = referenced.filter((path) => !existsSync(join(baseDir, path)));

if (stale.length === 0) {
  console.log(`✓ doc-drift: ${referenced.length} paths checked, 0 stale`);
  process.exit(0);
}

console.error(
  `✗ doc-drift: ${stale.length} stale path(s) in ${docPath} (referenced, not on disk):`,
);
for (const path of stale) console.error(`  ${path}`);
console.error('  Fix the tree to match the repo, or restore the path. Drift is a CI failure.');
process.exit(FAILURE_EXIT_CODE);
