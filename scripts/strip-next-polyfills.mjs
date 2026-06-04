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
 * Hardening (WS1, 2026-06-04): the prior version exited 0 silently when the
 * target was missing. If a Next upgrade reorganizes the polyfill path, that
 * silent no-op lets the Lighthouse penalty return with NO signal. This version
 * fails loudly (non-zero exit) on an absent or unexpectedly-shaped target, and
 * stays idempotent on re-install. Order matters: the idempotency check runs
 * BEFORE the shape assert, because an already-stripped file is tiny (73 bytes)
 * and would otherwise trip the size guard on every subsequent install.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = resolve('node_modules/next/dist/build/polyfills/polyfill-module.js');

// Sentinel = the first bytes this script writes; used for idempotency detection.
const SENTINEL = '// Stripped by scripts/strip-next-polyfills.mjs';
// WHY these thresholds: the real unstripped bundle is a ~14 KiB core-js build;
// the stripped form is 73 bytes. A 1 KiB floor cleanly separates the two. The
// `Object.defineProperty` token is the fundamental primitive every core-js
// polyfill uses (verified present in the sibling `polyfill-nomodule.js` bundle),
// so its absence means Next reshaped the bundle and the strip must be re-checked
// rather than blindly applied. A false-positive block here is a loud, one-line
// fix (update the assertion); a false-negative silent skip is the bug WS1 closes.
const MIN_SIZE_BYTES = 1024;
const KNOWN_TOKEN = 'Object.defineProperty';

if (!existsSync(target)) {
  console.error(
    `[strip-polyfills] polyfill-module.js not found at ${target}. ` +
      'Next.js may have reorganized the polyfill path — re-check the target ' +
      'before relying on the Lighthouse Best-Practices score.',
  );
  process.exit(1);
}

const current = readFileSync(target, 'utf8');

// Idempotency FIRST (before the shape assert): a second install sees the tiny
// already-stripped file, which would otherwise fail the MIN_SIZE_BYTES guard.
if (current.startsWith(SENTINEL)) {
  console.log('[strip-polyfills] already stripped — skipping');
  process.exit(0);
}

if (current.length < MIN_SIZE_BYTES || !current.includes(KNOWN_TOKEN)) {
  console.error(
    `[strip-polyfills] unexpected shape at ${target} ` +
      `(size ${current.length}B, token "${KNOWN_TOKEN}" ${
        current.includes(KNOWN_TOKEN) ? 'present' : 'absent'
      }). Next.js likely changed the polyfill bundle — re-verify before stripping.`,
  );
  process.exit(1);
}

writeFileSync(target, `${SENTINEL} — modern browsers only\n`, 'utf8');
console.log('[strip-polyfills] Next.js polyfill bundle cleared');
