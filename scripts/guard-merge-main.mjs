#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const BLOCK_EXIT_CODE = 2;
const PROTECTED_BASES = new Set(['main', 'master']);
const MERGE_TOOL = 'mcp__github__merge_pull_request';
const COMMAND_START =
  '(?:^|[;&|\\n(`]|-c\\s+["\'])\\s*(?:(?:env|command|exec|sudo|time|nohup)\\s+|\\S+=\\S+\\s+)*gh\\s+';
const PR_MERGE = new RegExp(`${COMMAND_START}pr\\s+merge\\b`, 'g');
const API_CALL = new RegExp(`${COMMAND_START}api\\b`, 'g');
const CD_COMMAND = /(?:^|[;&|\n(`]\s*)cd\b/g;
const REST_MERGE_PATH = /pulls\/([^/\s"']+)\/merge\b/;
const REST_REPO_PATH = /repos\/([^/\s"']+)\/([^/\s"']+)\//;
const PLACEHOLDER_PREFIX = '{';
const GRAPHQL_MERGE = /\bmergePullRequest\b/;
const PR_NUMBER = /^\d+$/;
const SEPARATORS = new Set([';', '&', '|', '\n', ')']);
const QUOTES = new Set(["'", '"']);
const SHELL_ONLY = new Set(['$', '`']);
const HOME_PREFIX = /^~\/?/;
const PREVIOUS_DIRECTORY = '-';
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

const tokenize = (text) => {
  const tokens = [];
  let current = '';
  let dynamic = false;
  let quote = null;
  let started = false;
  const flush = () => {
    if (started) tokens.push({ text: current, dynamic });
    current = '';
    dynamic = false;
    started = false;
  };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote !== null) {
      if (char === quote) quote = null;
      else {
        if (quote === '"' && SHELL_ONLY.has(char)) dynamic = true;
        current += char;
      }
    } else if (QUOTES.has(char)) {
      quote = char;
      started = true;
    } else if (SEPARATORS.has(char)) {
      break;
    } else if (/\s/.test(char)) {
      flush();
    } else if (char === '\\') {
      index += 1;
      current += text[index] ?? '';
      started = true;
    } else {
      if (SHELL_ONLY.has(char)) dynamic = true;
      current += char;
      started = true;
    }
  }
  flush();
  return tokens;
};

const parseMerge = (tokens) => {
  const parsed = { selector: undefined, repo: undefined, resolvable: true };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const [flag, inline] = token.text.split('=', 2);
    if (REPO_FLAGS.has(flag)) {
      if (inline === undefined) index += 1;
      const value = inline === undefined ? tokens[index] : { text: inline, dynamic: false };
      if (value === undefined || value.dynamic) parsed.resolvable = false;
      else parsed.repo = value.text;
    } else if (VALUE_FLAGS.has(flag)) {
      if (inline === undefined) index += 1;
    } else if (!token.text.startsWith('-') && parsed.selector === undefined) {
      if (token.dynamic) parsed.resolvable = false;
      parsed.selector = token.text;
    }
  }
  return parsed;
};

const directoryBefore = (command, index, startDirectory) => {
  let directory = startDirectory;
  for (const match of command.slice(0, index).matchAll(CD_COMMAND)) {
    const [target] = tokenize(command.slice(match.index + match[0].length));
    if (target === undefined) {
      directory = homedir();
    } else if (target.dynamic || target.text === PREVIOUS_DIRECTORY) {
      return undefined;
    } else if (HOME_PREFIX.test(target.text)) {
      directory = resolve(homedir(), target.text.replace(HOME_PREFIX, ''));
    } else {
      directory = resolve(directory, target.text);
    }
  }
  return directory;
};

const baseOf = ({ selector, repo, directory }) => {
  const args = ['pr', 'view'];
  if (selector !== undefined) args.push(selector);
  if (repo !== undefined) args.push('--repo', repo);
  args.push('--json', 'baseRefName', '--jq', '.baseRefName');
  const result = spawnSync('gh', args, { encoding: 'utf8', cwd: directory });
  if (result.error || result.status !== 0) return undefined;
  const base = result.stdout.trim();
  return base === '' ? undefined : base;
};

const block = (reason) => {
  process.stderr.write(`[guard-merge-main] ${reason}\n`);
  process.exit(BLOCK_EXIT_CODE);
};

const unresolved = (label) =>
  block(
    `Blocked: the base branch of ${label} could not be determined (gh unavailable, offline, no such PR, or a value only the shell can resolve). Merging is refused when the base is unknown. The owner merges into main.`,
  );

const verify = ({ label, resolvable = true, ...target }) => {
  if (!resolvable) unresolved(label);
  const base = baseOf(target);
  if (base === undefined) unresolved(label);
  if (PROTECTED_BASES.has(base)) {
    block(
      `Blocked: ${label} targets ${base}. AI agents never merge into main; the owner runs that merge. Sub-PRs into an integration branch may be merged after CI is green and review.`,
    );
  }
};

const restTarget = (tokens) => {
  const joined = tokens.map((token) => token.text).join(' ');
  if (GRAPHQL_MERGE.test(joined)) return { label: 'a GraphQL merge mutation', resolvable: false };
  const path = tokens.map((token) => token.text.match(REST_MERGE_PATH)).find(Boolean);
  if (!path) return undefined;
  const number = path[1];
  const repoMatch = tokens.map((token) => token.text.match(REST_REPO_PATH)).find(Boolean);
  const literalRepo = repoMatch && !repoMatch[1].startsWith(PLACEHOLDER_PREFIX);
  return {
    label: `PR ${number}`,
    selector: number,
    repo: literalRepo ? `${repoMatch[1]}/${repoMatch[2]}` : undefined,
    resolvable: PR_NUMBER.test(number),
  };
};

const input = readHookInput();
const startDirectory = typeof input.cwd === 'string' ? input.cwd : process.cwd();

if (input.tool_name === MERGE_TOOL) {
  const { owner, repo, pullNumber } = input.tool_input ?? {};
  const named = [owner, repo, pullNumber].every((value) => value !== undefined && value !== '');
  verify({
    label: named ? `${owner}/${repo}#${pullNumber}` : 'the pull request named by the call',
    resolvable: named,
    selector: String(pullNumber),
    repo: `${owner}/${repo}`,
    directory: startDirectory,
  });
  process.exit(0);
}

const command = input.tool_input?.command;
if (typeof command !== 'string') process.exit(0);

for (const match of command.matchAll(PR_MERGE)) {
  const end = match.index + match[0].length;
  const parsed = parseMerge(tokenize(command.slice(end)));
  const directory = directoryBefore(command, match.index, startDirectory);
  verify({
    label: parsed.selector ?? 'the current PR',
    ...parsed,
    resolvable: parsed.resolvable && directory !== undefined,
    directory,
  });
}

for (const match of command.matchAll(API_CALL)) {
  const end = match.index + match[0].length;
  const target = restTarget(tokenize(command.slice(end)));
  if (target === undefined) continue;
  const directory = directoryBefore(command, match.index, startDirectory);
  verify({ ...target, resolvable: target.resolvable && directory !== undefined, directory });
}
