/**
 * Overwrites Next.js's built-in polyfill bundle with a no-op after install.
 *
 * Why: Next.js unconditionally ships polyfills for Array.at, Object.hasOwn,
 * flatMap, fromEntries, trimStart/End, etc. regardless of browserslist.
 * These are all Baseline 2022 and supported by our target browsers
 * (Chrome 93+, Edge 93+, Firefox 92+, Safari 15.4+). The bundle is ~14 KiB
 * of dead code that Lighthouse flags as "Legacy JavaScript" (-4 pts, Best
 * Practices). Turbopack resolveAlias cannot intercept relative requires
 * inside node_modules, so postinstall overwrite is the only clean hook.
 *
 * Verification (2026-05-21): `next.config.ts` has `turbopack.resolveAlias`
 * pointing polyfill-module to `lib/polyfills-noop.ts`, but this only applies
 * to Turbopack builds (dev mode). The webpack production bundle still contains
 * the guard patterns (Array.prototype.at, Object.hasOwn, flatMap, fromEntries,
 * trimStart, URL.canParse) — confirmed by grepping .next/static/chunks/ after
 * `pnpm build` which returned 32 matches including if(!x.prototype.method)
 * guard assignments. This postinstall script remains the only mechanism that
 * strips polyfills from the webpack production build. See DECISIONS.md.
 *
 * Safe to re-run: writes a fixed string, idempotent.
 */

import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = resolve('node_modules/next/dist/build/polyfills/polyfill-module.js');

if (!existsSync(target)) {
  console.log('[strip-polyfills] polyfill-module.js not found — skipping');
  process.exit(0);
}

writeFileSync(
  target,
  '// Stripped by scripts/strip-next-polyfills.mjs — modern browsers only\n',
  'utf8',
);

console.log('[strip-polyfills] Next.js polyfill bundle cleared');
