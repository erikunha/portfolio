#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const DEFAULT_UPDATE_MODE = 'changed';
export const VISUAL_SPEC = 'tests/visual/visual.spec.ts';

const UPDATE_MODES = ['changed', 'all'];
const VISUAL_PROJECTS = ['chromium', 'chromium-mobile', 'webkit-desktop', 'webkit-mobile'];
const PLAYWRIGHT_COMMAND = 'pnpm';
const PLAYWRIGHT_ARGS = ['playwright', 'test'];
const BASE_URL_ENV = 'E2E_BASE_URL';
const UPDATE_MODE_ENV = 'UPDATE_MODE';
const GREP_ENV = 'GREP';
const BASELINE_PATH = 'tests/visual';
const BASELINE_EXTENSION = '.png';
const PORCELAIN_STATUS_WIDTH = 3;
const RENAME_SEPARATOR = ' -> ';
const USAGE_EXIT_CODE = 2;
const REPO_ROOT = process.cwd();

function resolveUpdateMode(mode) {
  if (mode === undefined) {
    return DEFAULT_UPDATE_MODE;
  }

  return mode.trim();
}

function resolveGrepSubject(grep) {
  return typeof grep === 'string' ? grep.trim() : '';
}

export function buildRegenPlan({ mode, grep, baseUrl, baseEnv = {} }) {
  const updateMode = resolveUpdateMode(mode);
  const grepSubject = resolveGrepSubject(grep);

  if (!UPDATE_MODES.includes(updateMode)) {
    throw new Error(`${UPDATE_MODE_ENV} must be "changed" or "all", received "${updateMode}".`);
  }

  if (updateMode === 'all' && grepSubject === '') {
    const reason = [
      `${GREP_ENV} is required when ${UPDATE_MODE_ENV} is "all".`,
      'The "changed" mode keeps a baseline whose diff is under maxDiffPixels, so a forced',
      'rewrite must be scoped to the subject that changed, never to the whole suite.',
      `Pass ${GREP_ENV}=<subject>.`,
    ].join(' ');

    throw new Error(reason);
  }

  if (!baseUrl) {
    throw new Error(`${BASE_URL_ENV} is required; it names the server to capture against.`);
  }

  return {
    command: PLAYWRIGHT_COMMAND,
    args: [
      ...PLAYWRIGHT_ARGS,
      VISUAL_SPEC,
      ...VISUAL_PROJECTS.map((project) => `--project=${project}`),
      `--update-snapshots=${updateMode}`,
      ...(grepSubject ? ['-g', grepSubject] : []),
    ],
    env: { ...baseEnv, [BASE_URL_ENV]: baseUrl },
  };
}

export function listChangedBaselines(porcelainOutput) {
  return porcelainOutput
    .split('\n')
    .filter((line) => line.trimEnd().endsWith(BASELINE_EXTENSION))
    .map((line) => line.slice(PORCELAIN_STATUS_WIDTH).trim())
    .map((filePath) => filePath.split(RENAME_SEPARATOR).pop() ?? filePath);
}

function printChangedBaselines() {
  const status = spawnSync('git', ['status', '--porcelain', '--', BASELINE_PATH], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  if (status.error) {
    console.error(`[regen-baselines] git status failed: ${status.error.message}`);

    return;
  }

  const changed = listChangedBaselines(status.stdout ?? '');

  if (changed.length === 0) {
    console.log('[regen-baselines] no changed PNG under tests/visual');

    return;
  }

  console.log('[regen-baselines] changed PNGs under tests/visual:');
  for (const file of changed) {
    console.log(`  ${file}`);
  }
  console.log('[regen-baselines] read every changed PNG before committing it');
}

function regenBaselines() {
  const plan = buildRegenPlan({
    mode: process.env[UPDATE_MODE_ENV],
    grep: process.env[GREP_ENV],
    baseUrl: process.env[BASE_URL_ENV],
    baseEnv: process.env,
  });

  console.log(`[regen-baselines] ${plan.command} ${plan.args.join(' ')}`);
  console.log(`[regen-baselines] ${BASE_URL_ENV}=${plan.env[BASE_URL_ENV]}`);

  const run = spawnSync(plan.command, plan.args, {
    stdio: 'inherit',
    env: plan.env,
    cwd: REPO_ROOT,
  });

  if (run.error) {
    throw new Error(`${plan.command} could not start: ${run.error.message}`);
  }

  printChangedBaselines();

  process.exit(run.status ?? USAGE_EXIT_CODE);
}

function main() {
  try {
    regenBaselines();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`[regen-baselines] ${message}`);

    process.exit(USAGE_EXIT_CODE);
  }
}

if (
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
