import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const PARENT_SEPARATOR = '>';
const VERSION_SEPARATOR = '@';
const SCOPE_PREFIX = '@';
const CARET = '^';
const PRERELEASE_OR_BUILD = /[-+].*$/;

type Version = readonly [number, number, number];

interface Lockfile {
  overrides?: Record<string, string>;
  packages?: Record<string, unknown>;
}

interface PackageJson {
  pnpm?: { overrides?: Record<string, string> };
}

function splitNameAndVersion(spec: string): { name: string; version: string } {
  const at = spec.indexOf(VERSION_SEPARATOR, spec.startsWith(SCOPE_PREFIX) ? 1 : 0);
  return at === -1
    ? { name: spec, version: '' }
    : { name: spec.slice(0, at), version: spec.slice(at + 1) };
}

function parseVersion(text: string): Version {
  const [major = 0, minor = 0, patch = 0] = text
    .replace(PRERELEASE_OR_BUILD, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10));
  return [major, minor, patch];
}

function compare(a: Version, b: Version): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function satisfiesCaret(version: Version, range: string): boolean {
  const base = parseVersion(range.slice(CARET.length));
  if (compare(version, base) < 0) return false;
  if (base[0] > 0) return version[0] === base[0];
  if (base[1] > 0) return version[0] === 0 && version[1] === base[1];
  return version[0] === 0 && version[1] === 0 && version[2] === base[2];
}

function overrideTarget(selector: string): string {
  const child = selector.split(PARENT_SEPARATOR).pop() ?? selector;
  return splitNameAndVersion(child).name;
}

function resolvedVersions(lock: Lockfile): Map<string, Version[]> {
  const byName = new Map<string, Version[]>();
  for (const key of Object.keys(lock.packages ?? {})) {
    const { name, version } = splitNameAndVersion(key);
    const list = byName.get(name) ?? [];
    list.push(parseVersion(version));
    byName.set(name, list);
  }
  return byName;
}

function deadOverrides(
  overrides: Record<string, string>,
  resolved: Map<string, Version[]>,
): string[] {
  return Object.entries(overrides)
    .filter(([selector, range]) => {
      const versions = resolved.get(overrideTarget(selector)) ?? [];
      if (!range.startsWith(CARET)) return versions.length === 0;
      return !versions.some((version) => satisfiesCaret(version, range));
    })
    .map(([selector]) => selector);
}

describe('pnpm.overrides', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as PackageJson;
  const lock = parse(readFileSync('pnpm-lock.yaml', 'utf8')) as Lockfile;
  const overrides = pkg.pnpm?.overrides ?? {};

  it('flags an override whose package is absent and one whose range nothing resolves to', () => {
    const resolved = new Map<string, Version[]>([['body-parser', [[1, 20, 9]]]]);
    expect(
      deadOverrides(
        { hono: '^4.12.34', 'body-parser@1': '^1.20.9', 'body-parser@>=2': '^2.3.0' },
        resolved,
      ),
    ).toEqual(['hono', 'body-parser@>=2']);
  });

  it('reads the child of a parent selector and the zero-major caret rule', () => {
    expect(overrideTarget('@lhci/cli>chrome-launcher')).toBe('chrome-launcher');
    expect(overrideTarget('@hono/node-server')).toBe('@hono/node-server');
    const resolved = new Map<string, Version[]>([['esbuild', [[0, 27, 9]]]]);
    expect(deadOverrides({ esbuild: '^0.28.2' }, resolved)).toEqual(['esbuild']);
  });

  it('matches the overrides the lockfile was resolved with', () => {
    expect(lock.overrides ?? {}).toEqual(overrides);
  });

  it('pins only packages the lockfile resolves inside the override range', () => {
    expect(
      deadOverrides(overrides, resolvedVersions(lock)),
      'these overrides resolve to nothing in pnpm-lock.yaml; remove them and run pnpm install --lockfile-only',
    ).toEqual([]);
  });
});
