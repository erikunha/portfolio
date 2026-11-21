import { join } from 'node:path';
import { importClosure } from '../lib/import-closure.ts';
import { listFiles } from '../lib/walk.ts';

const REPOSITORY_ROOT = join(import.meta.dirname, '../..');
const SOURCE_FILE = /\.tsx?$/;
const TEST_FILE = /\.(?:test|spec)\.tsx?$/;
const TEST_DIRECTORIES: ReadonlySet<string> = new Set(['__tests__']);

const AI_ENTRY_POINTS: readonly string[] = ['app/api/ask/route.ts', 'scripts/eval/ask-eval.ts'];

const AI_OWNED_DIRECTORIES: readonly string[] = [
  'app/api/ask/',
  'lib/ask/',
  'lib/server/',
  'lib/agent/',
  'lib/eval/',
];

export const AI_MANUAL_PATHS: readonly string[] = [
  ...AI_OWNED_DIRECTORIES,
  '__tests__/ask/',
  '.github/workflows/ci.yml',
];

function sourceFilesUnder(directory: string): string[] {
  return listFiles(join(REPOSITORY_ROOT, directory), {
    include: (name) => SOURCE_FILE.test(name) && !TEST_FILE.test(name),
    skipDirs: TEST_DIRECTORIES,
  }).map((file) => `${directory}${file}`);
}

export const AI_ROOTS: readonly string[] = [
  ...AI_ENTRY_POINTS,
  ...AI_OWNED_DIRECTORIES.flatMap(sourceFilesUnder),
];

const coveredByManualPath = (file: string): boolean =>
  AI_MANUAL_PATHS.some((path) => (path.endsWith('/') ? file.startsWith(path) : file === path));

export const AI_PATHS: readonly string[] = [
  ...AI_MANUAL_PATHS,
  ...importClosure(AI_ROOTS, REPOSITORY_ROOT).filter((file) => !coveredByManualPath(file)),
];

export const APP_PATHS: readonly string[] = [
  'app/',
  'components/',
  'design-system/',
  'lib/',
  'content/',
  'public/',
  'next.config.ts',
  '.github/workflows/',
  'lighthouserc.json',
  'lighthouserc.mobile.json',
  'scripts/gates/check-bundle-size.ts',
  'scripts/gates/check-route-js.ts',
  'scripts/ci/gates-runtime.ts',
  'scripts/ci/install-playwright-browsers.ts',
  'scripts/ci/wait-argos-reference.ts',
  'patches/',
  'playwright.config.ts',
  'instrumentation.ts',
  'mdx-components.tsx',
  'vercel.json',
  'postcss.config.mjs',
  'tsconfig.json',
  '.nvmrc',
  '.npmrc',
  'pnpm-workspace.yaml',
  'tests/',
  'package.json',
  'pnpm-lock.yaml',
];

export const UI_PATHS: readonly string[] = [
  'app/',
  'components/',
  'design-system/',
  'lib/',
  'content/',
  'public/',
  'next.config.ts',
  'playwright.config.ts',
  'mdx-components.tsx',
  'vercel.json',
  'postcss.config.mjs',
  'tsconfig.json',
  '.nvmrc',
  'patches/',
  'scripts/ci/install-playwright-browsers.ts',
  'scripts/ci/wait-argos-reference.ts',
  '.github/workflows/ci.yml',
  'tests/visual/',
  'tests/e2e/',
  'pnpm-lock.yaml',
  ':(exclude)lib/eval/**',
  ':(exclude)lib/env.test.ts',
];

export const IGNORED_PATHS: readonly string[] = [
  '.env.example',
  '.gitignore',
  '.gitleaks.toml',
  '.semgrepignore',
  'AGENTS.md',
  'ARCHITECTURE.md',
  'CLAUDE.md',
  'CODE_OF_CONDUCT.md',
  'CONTRIBUTING.md',
  'DECISIONS.md',
  'LICENSE',
  'README.md',
  'REVIEW.md',
  'SECURITY.md',
  'STANDARDS.md',
  'biome.json',
  'commitlint.config.ts',
  'dependency-vetting.json',
  'next-env.d.ts',
  'stryker.config.d.mts',
  'stryker.config.mjs',
  'vitest.config.ts',
  'scripts/__tests__/',
  'scripts/lib/',
  'scripts/ci/ci-full-linux.ts',
  'scripts/ci/ci-full-run.ts',
  'scripts/ci/ci-full-stages.ts',
  'scripts/ci/ci-workflow.ts',
  'scripts/ci/free-port.ts',
  'scripts/fonts/',
  'scripts/metrics/',
  'scripts/gates/check-client-naming.ts',
  'scripts/gates/check-component-docs-coverage.ts',
  'scripts/gates/check-css-ownership.ts',
  'scripts/gates/check-dep-pinning.ts',
  'scripts/gates/check-dependency-vetting.ts',
  'scripts/gates/check-detect-changes-paths.ts',
  'scripts/gates/check-doc-drift.ts',
  'scripts/gates/check-gitleaks-fixture.ts',
  'scripts/gates/check-harness-size.ts',
  'scripts/gates/check-mutation-kills.ts',
  'scripts/gates/check-no-dashes.ts',
  'scripts/gates/check-section-order.ts',
  'scripts/gates/check-shell-dom-writes.ts',
  'scripts/gates/check-tool-pins.ts',
  'scripts/gates/check-semgrep-fixture.ts',
  'scripts/gates/check-test-integrity.ts',
  'scripts/ci/ci-full.ts',
  'scripts/gates/contrast-check.ts',
  'scripts/ci/detect-changes-paths.ts',
  'scripts/ci/detect-changes.ts',
  'scripts/ci/doctor.ts',
  'scripts/codegen/changelog-merge.ts',
  'scripts/codegen/decisions-index.ts',
  'scripts/codegen/discovery-copy.ts',
  'scripts/codegen/feature-map.ts',
  'scripts/codegen/generate-discovery-files.ts',
  'scripts/codegen/generate-brand-icons.ts',
  'scripts/codegen/generate-og-image.ts',
  'scripts/gates/gitleaks-staged.ts',
  'scripts/gates/harness-size.json',
  'scripts/ci/high-risk-paths.ts',
  'scripts/ci/verify.ts',
  'scripts/gates/lint-css-tokens.allowlist.json',
  'scripts/install/prepare-hooks.ts',
  'scripts/gates/lint-css-tokens.ts',
  'scripts/gates/measure-semgrep-fp.ts',
  'scripts/gates/run-semgrep.ts',
  'scripts/gates/stryker-canary.config.mjs',
  'scripts/codegen/sync-changelog.ts',
  'scripts/eval/empty-module.ts',
  'scripts/eval/tsconfig.eval.json',
  'scripts/gates/validate-content.ts',
];
