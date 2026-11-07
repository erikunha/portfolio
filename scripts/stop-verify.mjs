#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BIOME_FILES = /\.(?:[cm]?[jt]sx?|json|css)$/;
const TS_FILES = /\.[cm]?tsx?$/;
const BLOCK_EXIT_CODE = 2;
const MAX_OUTPUT_CHARS = 4000;
const MAX_BUFFER_BYTES = 16 * 1024 * 1024;

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

const readHookInput = () => {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
};

const run = (command, args) =>
  spawnSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: MAX_BUFFER_BYTES });

const lines = (result) =>
  result.status === 0 ? result.stdout.split('\n').filter((line) => line !== '') : [];

const changedFiles = () =>
  [
    ...new Set([
      ...lines(run('git', ['diff', '--name-only', 'HEAD'])),
      ...lines(run('git', ['ls-files', '--others', '--exclude-standard'])),
    ]),
  ].filter((file) => existsSync(join(root, file)));

const block = (label, result) => {
  const output = `${result.stdout}${result.stderr}`.slice(0, MAX_OUTPUT_CHARS);
  process.stderr.write(
    `[stop-verify] ${label} failed. Fix it before ending the turn.\n${output}\n`,
  );
  process.exit(BLOCK_EXIT_CODE);
};

if (readHookInput().stop_hook_active === true) process.exit(0);
if (process.env.CI || process.env.GITHUB_ACTIONS) process.exit(0);

const bin = (name) => join(root, 'node_modules', '.bin', name);
const changed = changedFiles();
const biomeFiles = changed.filter((file) => BIOME_FILES.test(file));

if (biomeFiles.length > 0 && existsSync(bin('biome'))) {
  const result = run(bin('biome'), [
    'check',
    '--no-errors-on-unmatched',
    '--files-ignore-unknown=true',
    ...biomeFiles,
  ]);
  if (result.status !== 0) block('biome check on the changed files', result);
}

if (changed.some((file) => TS_FILES.test(file)) && existsSync(bin('tsgo'))) {
  const result = run(bin('tsgo'), ['--noEmit']);
  if (result.status !== 0) block('typecheck', result);
}
