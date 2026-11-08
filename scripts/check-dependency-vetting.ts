#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEPENDENCY_BLOCKS = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;
const INSTALL_SCRIPTS = ['preinstall', 'install', 'postinstall'] as const;
const MANIFEST_FILE = 'package.json';
const VETTING_FILE = 'dependency-vetting.json';
const LICENSE_JOINER = ' OR ';
const EXIT_VIOLATION = 1;
const EXIT_GATE_ERROR = 2;

export interface VettingEntry {
  purpose?: unknown;
  license?: unknown;
}

export interface InstalledPackage {
  license: string | null;
  installScripts: string[];
}

export interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  pnpm?: { onlyBuiltDependencies?: string[] };
}

export interface VettingInput {
  manifest: Manifest;
  vetting: Record<string, VettingEntry>;
  installed: Record<string, InstalledPackage | undefined>;
}

interface RawPackageJson {
  license?: unknown;
  licenses?: unknown;
  scripts?: Record<string, unknown>;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

export function normalizeLicense(pkg: RawPackageJson): string | null {
  const direct = nonEmptyString(pkg.license);
  if (direct) return direct;
  if (typeof pkg.license === 'object' && pkg.license !== null) {
    return nonEmptyString((pkg.license as { type?: unknown }).type);
  }
  if (Array.isArray(pkg.licenses)) {
    const types = pkg.licenses
      .map((entry) => nonEmptyString((entry as { type?: unknown } | null)?.type))
      .filter((type): type is string => type !== null);
    return types.length > 0 ? types.join(LICENSE_JOINER) : null;
  }
  return null;
}

export function readInstalled(root: string, name: string): InstalledPackage | undefined {
  let raw: RawPackageJson;
  try {
    raw = JSON.parse(readFileSync(join(root, 'node_modules', name, MANIFEST_FILE), 'utf8'));
  } catch {
    return undefined;
  }
  const scripts = raw.scripts ?? {};
  return {
    license: normalizeLicense(raw),
    installScripts: INSTALL_SCRIPTS.filter((script) => typeof scripts[script] === 'string'),
  };
}

export function directDependencies(manifest: Manifest): string[] {
  return [...new Set(DEPENDENCY_BLOCKS.flatMap((block) => Object.keys(manifest[block] ?? {})))];
}

export function findViolations({ manifest, vetting, installed }: VettingInput): string[] {
  const violations: string[] = [];
  const direct = directDependencies(manifest);
  const allowedToBuild = new Set(manifest.pnpm?.onlyBuiltDependencies ?? []);

  for (const name of Object.keys(vetting)) {
    if (!direct.includes(name)) {
      violations.push(`${name}: has an entry but is not a direct dependency in ${MANIFEST_FILE}`);
    }
  }

  for (const name of direct) {
    const entry = vetting[name];
    if (!entry) {
      violations.push(`${name}: direct dependency has no entry in ${VETTING_FILE}`);
      continue;
    }
    if (!nonEmptyString(entry.purpose)) {
      violations.push(`${name}: entry has no purpose`);
    }
    const recorded = nonEmptyString(entry.license);
    if (!recorded) {
      violations.push(`${name}: entry records no license`);
    }

    const pkg = installed[name];
    if (!pkg) {
      violations.push(`${name}: not installed, so its license and install scripts cannot be read`);
      continue;
    }
    if (pkg.license === null) {
      violations.push(`${name}: installed package declares no license`);
    } else if (recorded && pkg.license !== recorded) {
      violations.push(
        `${name}: installed license "${pkg.license}" differs from recorded "${recorded}"; re-vet it`,
      );
    }
    if (pkg.installScripts.length > 0 && !allowedToBuild.has(name)) {
      violations.push(
        `${name}: runs ${pkg.installScripts.join(', ')} but is not in pnpm.onlyBuiltDependencies`,
      );
    }
  }
  return violations;
}

function gateError(reason: string): never {
  console.error(`[dependency-vetting] GATE ERROR: ${reason}`);
  process.exit(EXIT_GATE_ERROR);
}

function readJson<T>(file: string): T {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch (err) {
    return gateError(`cannot read ${file}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function main(): void {
  const root = resolve(process.argv[2] ?? process.cwd());
  const manifest = readJson<Manifest>(join(root, MANIFEST_FILE));
  const vetting = readJson<Record<string, VettingEntry>>(join(root, VETTING_FILE));
  const installed: Record<string, InstalledPackage | undefined> = {};
  for (const name of directDependencies(manifest)) installed[name] = readInstalled(root, name);

  const violations = findViolations({ manifest, vetting, installed });
  if (violations.length === 0) {
    console.log('✓ dependency-vetting: 0 violations');
    return;
  }
  console.error(`✗ dependency-vetting: ${violations.length} violation(s):`);
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    `  Every direct dependency needs a purpose and license in ${VETTING_FILE}; install scripts need pnpm.onlyBuiltDependencies.`,
  );
  process.exit(EXIT_VIOLATION);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
