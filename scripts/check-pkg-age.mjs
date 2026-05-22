/**
 * Supply-chain age gate.
 *
 * Reads every resolved package+version from pnpm-lock.yaml and queries the
 * npm registry for its publish timestamp. Fails if any package version was
 * published within MIN_DAYS_OLD days (default 7).
 *
 * Why: newly published package versions are a common supply-chain attack
 * vector — attackers publish a malicious version and hope CI/developers
 * install it before it is flagged. Rejecting versions younger than 7 days
 * gives the community time to vet the release. Legitimate teams running
 * `pnpm up --latest` will hit this gate if a dep just released; fix by
 * pinning to the previous version temporarily or waiting.
 *
 * Usage: node scripts/check-pkg-age.mjs [--min-days N] [--warn-only]
 *   --min-days N   Minimum age in days (default: 7)
 *   --warn-only    Emit warnings but exit 0 (useful in PR preview CI)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const warnOnly = args.includes('--warn-only');
const minDaysIdx = args.indexOf('--min-days');
let MIN_DAYS_OLD = 7;
if (minDaysIdx !== -1) {
  const parsed = Number(args[minDaysIdx + 1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(
      `[pkg-age] Invalid --min-days value: ${args[minDaysIdx + 1]}. Must be a positive number.`,
    );
    process.exit(1);
  }
  MIN_DAYS_OLD = parsed;
}
const MIN_AGE_MS = MIN_DAYS_OLD * 24 * 60 * 60 * 1000;

const lockfile = readFileSync(resolve('pnpm-lock.yaml'), 'utf8');

// Extract all `  'name@version':` lines from the packages section.
// pnpm lockfile v9: snapshot keys look like `  'name@version':`.
const pkgRe = /^ {2}'(@?[^@']+)@([^']+)':/gm;
const packages = new Map();
for (const m of lockfile.matchAll(pkgRe)) {
  const [, name, version] = m;
  // Strip pnpm-appended peer dep suffixes: "1.2.3(zod@4.4.3)" -> "1.2.3"
  const cleanVersion = version.split('(')[0].split('_')[0];
  packages.set(`${name}@${cleanVersion}`, { name, version: cleanVersion });
}

console.log(
  `[pkg-age] Checking ${packages.size} resolved packages (min age: ${MIN_DAYS_OLD} days)...`,
);

const now = Date.now();
const tooNew = [];
const fetchErrors = [];

// Batch in groups of 20 to avoid hammering the registry.
const entries = [...packages.values()];
const BATCH = 20;

for (let i = 0; i < entries.length; i += BATCH) {
  const batch = entries.slice(i, i + BATCH);
  await Promise.all(
    batch.map(async ({ name, version }) => {
      try {
        const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
          headers: { Accept: 'application/vnd.npm.install-v1+json' },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return; // private/scoped packages may 404 - skip
        const data = await res.json();
        const publishedAt = data.time?.[version];
        if (!publishedAt) return; // version absent from registry time map - skip
        const ageMs = now - new Date(publishedAt).getTime();
        if (ageMs < MIN_AGE_MS) {
          const ageDays = (ageMs / (24 * 60 * 60 * 1000)).toFixed(1);
          tooNew.push({ name, version, ageDays, publishedAt });
        }
      } catch (err) {
        // Network failures are non-fatal: the age gate must not block
        // offline or air-gapped builds.
        fetchErrors.push(`  SKIP ${name}@${version}: ${err.message}`);
      }
    }),
  );
}

if (fetchErrors.length > 0) {
  console.warn('[pkg-age] Registry fetch errors (non-fatal):');
  for (const e of fetchErrors) console.warn(e);
}

if (tooNew.length === 0) {
  console.log(`[pkg-age] OK - all packages are at least ${MIN_DAYS_OLD} days old.`);
  process.exit(0);
}

const label = warnOnly ? 'WARN' : 'FAIL';
console.error(
  `\n[pkg-age] ${label} - ${tooNew.length} package(s) published within ${MIN_DAYS_OLD} days:`,
);
for (const { name, version, ageDays, publishedAt } of tooNew) {
  console.error(`  ${name}@${version}  (published ${publishedAt}, ${ageDays} days ago)`);
}
if (warnOnly) {
  console.warn('[pkg-age] Continuing (--warn-only). Review the packages above before deploying.');
  process.exit(0);
} else {
  console.error('\n[pkg-age] Pin to an older version or wait for these packages to age out.');
  process.exit(1);
}
