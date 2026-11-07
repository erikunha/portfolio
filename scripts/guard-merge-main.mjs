#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BLOCK_EXIT_CODE = 2;
const PROTECTED_BASES = new Set(['main', 'master']);
const MERGE_COMMAND = /\bgh\s+pr\s+merge\b([^;&|\n]*)/g;
const VALUE_FLAGS = new Set([
  '-b',
  '--body',
  '-F',
  '--body-file',
  '-t',
  '--subject',
  '-A',
  '--author-email',
  '--match-head-commit',
]);
const REPO_FLAGS = new Set(['-R', '--repo']);

const readHookInput = () => {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
};

const parseMerge = (argText) => {
  const tokens = argText.trim().split(/\s+/).filter(Boolean);
  const parsed = { selector: undefined, repo: undefined };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const [flag, inline] = token.split('=', 2);
    if (REPO_FLAGS.has(flag)) {
      if (inline === undefined) index += 1;
      parsed.repo = inline ?? tokens[index];
    } else if (VALUE_FLAGS.has(flag)) {
      if (inline === undefined) index += 1;
    } else if (!token.startsWith('-') && parsed.selector === undefined) {
      parsed.selector = token;
    }
  }
  return parsed;
};

const baseOf = ({ selector, repo }) => {
  const args = ['pr', 'view'];
  if (selector !== undefined) args.push(selector);
  if (repo !== undefined) args.push('--repo', repo);
  args.push('--json', 'baseRefName', '--jq', '.baseRefName');
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) return undefined;
  const base = result.stdout.trim();
  return base === '' ? undefined : base;
};

const block = (reason) => {
  process.stderr.write(`[guard-merge-main] ${reason}\n`);
  process.exit(BLOCK_EXIT_CODE);
};

const command = readHookInput().tool_input?.command;
if (typeof command !== 'string') process.exit(0);

for (const match of command.matchAll(MERGE_COMMAND)) {
  const parsed = parseMerge(match[1]);
  const base = baseOf(parsed);
  if (base === undefined) {
    block(
      `Blocked: the base branch of ${parsed.selector ?? 'the current PR'} could not be determined (gh unavailable, offline, or no such PR). Merging is refused when the base is unknown. The owner merges into main.`,
    );
  }
  if (PROTECTED_BASES.has(base)) {
    block(
      `Blocked: ${parsed.selector ?? 'the current PR'} targets ${base}. AI agents never merge into main; the owner runs that merge. Sub-PRs into an integration branch may be merged after CI is green and review.`,
    );
  }
}
