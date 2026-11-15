import { readFileSync } from 'node:fs';

type DependencyMap = Record<string, unknown>;

interface PackageManifest {
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  optionalDependencies?: DependencyMap;
  pnpm?: { overrides?: DependencyMap };
}

const DEFAULT_MANIFEST_PATH = 'package.json';
const MANIFEST_ARG_INDEX = 2;
const FAILURE_EXIT_CODE = 1;

const BANNED = /^(latest|\*|x|next|canary|beta|alpha)$/i;
const RANGED = /^(\^|~)\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const PRERELEASE_EXACT = /^\d+\.\d+\.\d+-[0-9A-Za-z.-]+$/;
const TILDE = '~';
const LOCAL_SPEC_PREFIXES = ['workspace:', 'file:', 'link:'];
const DEPENDENCY_BLOCKS = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;

const TILDE_REQUIRED: ReadonlySet<string> = new Set([
  'next',
  '@next/mdx',
  'react',
  'react-dom',
  'zod',
  'typescript',
  '@biomejs/biome',
  '@playwright/test',
  'playwright',
  'shiki',
  'rehype-pretty-code',
]);

const manifestPath = process.argv[MANIFEST_ARG_INDEX] ?? DEFAULT_MANIFEST_PATH;
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as PackageManifest;

const violations: string[] = [];
for (const block of DEPENDENCY_BLOCKS) {
  for (const [name, raw] of Object.entries(manifest[block] ?? {})) {
    if (typeof raw !== 'string') continue;
    const spec = raw.trim();
    if (LOCAL_SPEC_PREFIXES.some((prefix) => spec.startsWith(prefix))) continue;
    if (PRERELEASE_EXACT.test(spec)) continue;
    if (BANNED.test(spec)) {
      violations.push(`  ${block}.${name}: "${raw}" is unbounded`);
    } else if (!RANGED.test(spec)) {
      violations.push(`  ${block}.${name}: "${raw}" is not a ^ or ~ range`);
    } else if (TILDE_REQUIRED.has(name) && !spec.startsWith(TILDE)) {
      violations.push(
        `  ${block}.${name}: "${raw}" must be a ~ range (its minors break this repo)`,
      );
    }
  }
}

for (const [name, raw] of Object.entries(manifest.pnpm?.overrides ?? {})) {
  if (typeof raw !== 'string') continue;
  const spec = raw.trim();
  if (PRERELEASE_EXACT.test(spec)) continue;
  if (BANNED.test(spec)) {
    violations.push(`  pnpm.overrides.${name}: "${raw}" is unbounded`);
  } else if (!RANGED.test(spec)) {
    violations.push(`  pnpm.overrides.${name}: "${raw}" is not a ^ or ~ range`);
  }
}

if (violations.length === 0) {
  console.log('✓ dep-pinning: 0 violations');
  process.exit(0);
}
console.error(`✗ dep-pinning: ${violations.length} violation(s):`);
for (const violation of violations) console.error(violation);
console.error(
  '  Convention: ^x.y.z by default, ~x.y.z for the packages in TILDE_REQUIRED, an exact version only for a prerelease build.',
);
process.exit(FAILURE_EXIT_CODE);
