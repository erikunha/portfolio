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
  importers?: Record<string, { dependencies?: Record<string, { version: string }> }>;
  snapshots?: Record<string, { dependencies?: Record<string, string> }>;
};

const IGNORED: Record<string, { pkg: string; vulnerable: (version: string) => boolean }> = {
  'GHSA-jmr9-qjv8-65gv': { pkg: 'extract-zip', vulnerable: () => true },
  'GHSA-7pqw-9j4j-h8q3': { pkg: 'extract-zip', vulnerable: () => true },
  'GHSA-mrhx-c7xc-m3w5': { pkg: 'zod', vulnerable: (v) => compareVersions(v, '4.6.6') < 0 },
};

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

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
  const queue = Object.entries(rootProd).map(([name, dep]) => `${name}@${dep.version}`);
  const snapshots = lock.snapshots ?? {};
  while (queue.length > 0) {
    const key = queue.pop();
    if (key === undefined || seen.has(key)) continue;
    seen.add(key);
    for (const [dep, version] of Object.entries(snapshots[key]?.dependencies ?? {})) {
      const next = `${dep}@${version}`;
      if (!seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

function productionVersions(name: string): string[] {
  return [...productionClosure()]
    .filter((key) => packageNameFromSnapshotKey(key) === name)
    .map((key) => (key.split('(')[0] ?? key).slice(name.length + 1));
}

describe('audit ignore list stays scoped and justified', () => {
  it('ignores only the advisories argued below — a list that grows silently is how a real finding hides', () => {
    expect([...(pkg.pnpm?.auditConfig?.ignoreGhsas ?? [])].sort()).toEqual(
      Object.keys(IGNORED).sort(),
    );
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
      productionVersions('@ai-sdk/gateway').length > 0,
      'the production closure is truncated: a package reachable only through a peer-suffixed key is missing, so any "extract-zip is absent" result from it is meaningless',
    ).toBe(true);
  });

  it.each(Object.entries(IGNORED))(
    'keeps every version %s covers out of the production dependency closure',
    (ghsa, { pkg: name, vulnerable }) => {
      const reachable = productionVersions(name).filter(vulnerable);
      expect(
        reachable,
        `${name}@${reachable.join(', ')} is reachable from production dependencies. ${ghsa} is ignored in package.json ONLY because every vulnerable copy is dev-only. Delete the ignore and re-argue it, or remove the production path — do not widen the ignore.`,
      ).toEqual([]);
    },
  );

  it('the negative control: a vulnerable copy in the closure would be caught', () => {
    expect(IGNORED['GHSA-mrhx-c7xc-m3w5']?.vulnerable('3.25.76')).toBe(true);
    expect(IGNORED['GHSA-mrhx-c7xc-m3w5']?.vulnerable('4.6.7')).toBe(false);
    expect(productionVersions('zod').length).toBeGreaterThan(0);
  });
});
