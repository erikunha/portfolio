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

function packageNameFromSnapshotKey(key: string): string {
  // A snapshot key is `name@version(peer@version)(...)`. Cutting at the last '@' lands
  // INSIDE the peer suffix for the 88 keys here that carry one — `ai@7.0.85(zod@4.4.3)`
  // yields `ai@7.0.85(zod`, so `ai` never matches and its whole subtree goes unwalked.
  const base = key.split('(')[0] ?? key;
  return base.slice(0, base.lastIndexOf('@'));
}

function productionClosure(): Set<string> {
  const seen = new Set<string>();
  const rootProd = lock.importers?.['.']?.dependencies ?? {};
  const queue = Object.keys(rootProd).map((name) => name);

  const snapshots = lock.snapshots ?? {};
  const byName = new Map<string, string[]>();
  for (const key of Object.keys(snapshots)) {
    const name = packageNameFromSnapshotKey(key);
    byName.set(name, [...(byName.get(name) ?? []), key]);
  }
  const keyFor = (name: string) => byName.get(name) ?? [];

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

  it('parses a peer-suffixed snapshot key, the shape 88 keys here actually have', () => {
    expect(packageNameFromSnapshotKey('ai@7.0.85(zod@4.4.3)')).toBe('ai');
    expect(packageNameFromSnapshotKey('@anthropic-ai/sdk@0.112.3(zod@4.4.3)')).toBe(
      '@anthropic-ai/sdk',
    );
    expect(packageNameFromSnapshotKey('@types/node@26.4.0')).toBe('@types/node');
    expect(packageNameFromSnapshotKey('extract-zip@2.0.1')).toBe('extract-zip');
  });

  it('walks the whole production graph, not a truncated prefix of it', () => {
    // The closure test below can only be trusted if the walk actually reaches through
    // peer-suffixed keys. @ai-sdk/gateway is reachable ONLY via `ai`, whose snapshot key
    // carries a peer suffix, so its absence means the traversal stopped early and a
    // "not reachable" result would be fail-open rather than true.
    expect(
      productionClosure().has('@ai-sdk/gateway'),
      'the production closure is truncated: a package reachable only through a peer-suffixed key is missing, so any "extract-zip is absent" result from it is meaningless',
    ).toBe(true);
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
