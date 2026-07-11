import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function parseLockfilePackages(lockfileContent) {
  const pkgRe = /^ {2}'(@?[^@']+)@([^']+)':/gm;
  const packages = new Map();
  for (const m of lockfileContent.matchAll(pkgRe)) {
    const [, name, version] = m;
    const cleanVersion = version.split('(')[0].split('_')[0];
    packages.set(`${name}@${cleanVersion}`, { name, version: cleanVersion });
  }
  return packages;
}

async function main() {
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
  const packages = parseLockfilePackages(lockfile);

  if (packages.size === 0) {
    console.error(
      '[pkg-age] GATE ERROR: matched 0 packages in pnpm-lock.yaml. The lockfile is empty or its snapshot-key format changed; the age gate cannot run. Refusing to pass vacuously.',
    );
    process.exit(2);
  }

  console.log(
    `[pkg-age] Checking ${packages.size} resolved packages (min age: ${MIN_DAYS_OLD} days)...`,
  );

  const now = Date.now();
  const tooNew = [];
  const fetchErrors = [];

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
          if (!res.ok) {
            if (res.status === 404 || res.status === 401) return;
            fetchErrors.push(`  WARN ${name}@${version}: registry returned HTTP ${res.status}`);
            return;
          }
          const data = await res.json();
          const publishedAt = data.time?.[version];
          if (!publishedAt) return;
          const ageMs = now - new Date(publishedAt).getTime();
          if (ageMs < MIN_AGE_MS) {
            const ageDays = (ageMs / (24 * 60 * 60 * 1000)).toFixed(1);
            tooNew.push({ name, version, ageDays, publishedAt });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          fetchErrors.push(`  SKIP ${name}@${version}: ${msg}`);
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
}

if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((err) => {
    console.error(`[pkg-age] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(err?.code === 'ENOENT' || err?.code === 'EACCES' ? 2 : 1);
  });
}
