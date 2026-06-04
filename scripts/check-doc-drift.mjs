#!/usr/bin/env node
// scripts/check-doc-drift.mjs
//
// CI gate for the Documentation-truth standard (audit WS6): the ARCHITECTURE.md
// directory tree must not reference a path that no longer exists. Doc drift —
// a file tree describing a structure the repo has since outgrown — is the
// highest-churn falsehood in the reference docs. This gate turns it into a
// build failure: rename or delete a file and the stale doc line fails CI.
//
// HOW THE CHECKABLE REGION IS DELIMITED
//   The tree is bounded by two HTML-comment markers placed OUTSIDE the fenced
//   code block:
//       <!-- doc-drift:start -->
//       ```
//       app/page.tsx            # one full repo-relative path per line
//       ```
//       <!-- doc-drift:end -->
//   Markers live outside the fence so they render invisibly in Markdown, and
//   the fence (```) lines are ignored by the parser. Every other non-blank,
//   non-comment line inside the region is a checkable path: its first
//   whitespace-delimited token (with a trailing `,` or `/` stripped, and any
//   `# …` annotation removed) is resolved against the doc's own directory and
//   must exist on disk.
//
// FAIL-LOUD CONTRACT
//   If either marker is absent the gate exits 1 — it must never vacuously pass
//   because it could not locate its own input. (This is the WS0 false-green
//   lesson encoded: a check that can't find what it measures must shout, not
//   silently report success.)
//
// Usage: node scripts/check-doc-drift.mjs [path/to/ARCHITECTURE.md]
//        defaults to ARCHITECTURE.md in the current working directory.

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

/** Extract checkable repo-relative paths from the marked tree region. */
function extractPaths(text) {
  const paths = [];
  for (const raw of text.split('\n')) {
    if (/^\s*```/.test(raw)) continue; // fence line, not a path
    const noComment = raw.replace(/#.*$/, ''); // drop "# annotation"
    const trimmed = noComment.trim();
    if (trimmed === '') continue; // blank or pure-comment line
    const token = trimmed.split(/\s+/)[0].replace(/[,/]+$/, ''); // first token, no trailing , or /
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
