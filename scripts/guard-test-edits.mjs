#!/usr/bin/env node

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const BLOCK_EXIT_CODE = 2;
const FIX_MODE_ENV = 'FIX_MODE';
const FIX_MODE_ON = '1';
const FIX_MODE_MARKER = join('.claude', 'fix-mode');
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const TEST_FILE = /\.(?:test|spec|e2e)\.[cm]?[jt]sx?$/;
const TEST_DIRS = new Set(['tests', '__tests__']);

const readHookInput = () => {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
};

const canonical = (path) => {
  try {
    return realpathSync(path);
  } catch {
    const parent = dirname(path);
    return parent === path ? path : join(canonical(parent), basename(path));
  }
};

const root = canonical(resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd()));

const fixModeDeclared = () =>
  process.env[FIX_MODE_ENV] === FIX_MODE_ON || existsSync(join(root, FIX_MODE_MARKER));

const isTestPath = (relativePath) => {
  const segments = relativePath.split(sep);
  return TEST_FILE.test(relativePath) || segments.some((segment) => TEST_DIRS.has(segment));
};

const input = readHookInput();
if (!EDIT_TOOLS.has(input.tool_name) || !fixModeDeclared()) process.exit(0);

const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
if (typeof target !== 'string' || target === '') process.exit(0);

const absolute = canonical(isAbsolute(target) ? target : resolve(root, target));
const relativePath = relative(root, absolute);
const outsideRoot = relativePath.startsWith('..') || isAbsolute(relativePath);
if (outsideRoot || !isTestPath(relativePath) || !existsSync(absolute)) process.exit(0);

process.stderr.write(
  `[guard-test-edits] Blocked: ${relativePath} is an existing test file and a fix task is declared (${FIX_MODE_ENV}=${FIX_MODE_ON} or ${FIX_MODE_MARKER}). ` +
    'A fix keeps the existing tests as the oracle, so editing one to make it pass is refused. ' +
    'Prove the defect with a new test file (creating one is allowed), then change the source until the old and new tests pass. ' +
    `If the existing test itself is wrong, tell the owner why, and lift the mode (unset ${FIX_MODE_ENV} or delete ${FIX_MODE_MARKER}) only after they agree.\n`,
);
process.exit(BLOCK_EXIT_CODE);
