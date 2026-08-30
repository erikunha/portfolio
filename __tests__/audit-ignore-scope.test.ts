import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// behavioral-test-allow: the artifacts under test ARE package.json and pnpm-lock.yaml.
// This asserts a property OF the manifests (what the audit gate is allowed to ignore, and
// whether the ignored advisory can reach production), which has no runtime surface to
// exercise instead.
const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  pnpm?: { auditConfig?: { ignoreGhsas?: string[] } };
};
const lock = parse(readFileSync(resolve(root, 'pnpm-lock.yaml'), 'utf8')) as {
  importers?: Record<string, { dependencies?: Record<string, unknown> }>;
  snapshots?: Record<string, { dependencies?: Record<string, string> }>;
};

const EXTRACT_ZIP_GHSA = 'GHSA-jmr9-qjv8-65gv';

function productionClosure(): Set<string> {
  const seen = new Set<string>();
  const rootProd = lock.importers?.['.']?.dependencies ?? {};
  const queue = Object.keys(rootProd).map((name) => name);

  const snapshots = lock.snapshots ?? {};
  const keyFor = (name: string) =>
    Object.keys(snapshots).filter((k) => k.slice(0, k.lastIndexOf('@')) === name);

  while (queue.length > 0) {
    const name = queue.pop();
    if (name === undefined || seen.has(name)) continue;
    seen.add(name);
    for (const key of keyFor(name)) {
      for (const dep of Object.keys(snapshots[key]?.dependencies ?? {})) {
        if (!seen.has(dep)) queue.push(dep);
      }
    }
  }
  return seen;
}

describe('audit ignore list stays scoped and justified', () => {
  it('ignores exactly one advisory — a list that grows silently is how a real finding hides', () => {
    expect(pkg.pnpm?.auditConfig?.ignoreGhsas).toEqual([EXTRACT_ZIP_GHSA]);
  });

  it('ignores by advisory id, never by severity or package wildcard', () => {
    for (const entry of pkg.pnpm?.auditConfig?.ignoreGhsas ?? []) {
      expect(entry, `"${entry}" is not a GHSA id`).toMatch(
        /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/,
      );
    }
  });

  it('keeps extract-zip out of the production dependency closure', () => {
    // The whole justification for ignoring GHSA-jmr9-qjv8-65gv is that extract-zip is
    // dev-only: it arrives via @lhci/cli -> lighthouse -> puppeteer-core ->
    // @puppeteer/browsers and unpacks browser archives at test time. If it ever becomes
    // reachable from `dependencies`, the advisory reaches shipped code and the ignore is
    // no longer defensible.
    expect(
      productionClosure().has('extract-zip'),
      'extract-zip is now reachable from production dependencies. GHSA-jmr9-qjv8-65gv is ignored in package.json ONLY because the package is dev-only and has no patched release. Delete the ignore and re-argue it, or remove the production path — do not widen the ignore.',
    ).toBe(false);
  });
});
