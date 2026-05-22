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
 * Update (2026-05-22): `turbopack.resolveAlias` was removed from `next.config.ts`
 * because Vercel CLI 54.3.0 `modifyConfig` crashes (ERR_INVALID_ARG_TYPE) when
 * processing `resolveAlias` entries in production builds. The alias only ever
 * applied to Turbopack dev builds anyway — this postinstall script is the sole
 * mechanism stripping polyfills from webpack production builds. See DECISIONS.md.
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
