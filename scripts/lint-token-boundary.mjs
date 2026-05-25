#!/usr/bin/env node
// Rejects direct primitive references in .module.css when a semantic alias exists.
// Run: node scripts/lint-token-boundary.mjs
import { scanCssModules } from './lib/scan-css.mjs';

// Patterns that are FORBIDDEN (primitives that have semantic aliases).
// Each regex matches only the specific token shape that must be aliased:
// --ds-text-\d+ matches digit-suffix color tokens (--ds-text-100, --ds-text-300)
// without catching --ds-text-size-* or --ds-text-leading-* (those have letter suffixes).
//
// Note: --ds-text-leading-* tokens are intentionally NOT in FORBIDDEN.
// They are terminal tokens (no semantic alias wraps them). Direct use
// in CSS (e.g. line-height: var(--ds-text-leading-base)) is correct.
const FORBIDDEN = [
  { pattern: /var\(\s*--ds-green-\d+[^)]*\)/g, hint: 'use --ds-color-* semantic alias' },
  { pattern: /var\(\s*--ds-text-\d+[^)]*\)/g, hint: 'use --ds-color-text-* semantic alias' },
  { pattern: /var\(\s*--ds-neutral-\d+[^)]*\)/g, hint: 'use --ds-color-surface-* semantic alias' },
  { pattern: /var\(\s*--ds-accent-[a-z]+[^)]*\)/g, hint: 'use --ds-color-accent-* semantic alias' },
  {
    pattern: /var\(\s*--ds-feedback-[a-z]+[^)]*\)/g,
    hint: 'use --ds-color-feedback-* semantic alias',
  },
  { pattern: /var\(\s*--ds-space-\d+[^)]*\)/g, hint: 'use --ds-space-pad/rhythm semantic alias' },
  {
    pattern: /var\(\s*--ds-text-size-[a-z0-9-]+[^)]*\)/g,
    hint: 'use --ds-font-size-* semantic alias',
  },
];

// Scan all .module.css files except the dist/tokens.css file (primitives are valid there).
const cssFiles = await scanCssModules();

let violations = 0;
for (const { rel, stripped: content } of cssFiles) {
  for (const { pattern, hint } of FORBIDDEN) {
    const matches = content.match(pattern);
    if (matches) {
      for (const m of matches) {
        console.error(`BOUNDARY VIOLATION in ${rel}: ${m} — ${hint}`);
        violations++;
      }
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} token boundary violation(s). Fix before merging.`);
  process.exit(1);
}
console.log(`Token boundary check passed (${cssFiles.length} files).`);
