#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const BLOCK_EXIT_CODE = 2;
const PROTECTED_BASES = new Set(['main', 'master']);
const MERGE_TOOL = 'mcp__github__merge_pull_request';
const GH_WORD = /(?:^|[\s;&|(`{])gh(?=[\s;&|)`}]|$)/;
const GH_PATH = /(^|[\s;&|(`{])[^\s;&|()`{}]*\/gh(?=[\s;&|)`}]|$)/g;
const PR_MERGE_INTENT = /\bpr(?:\s+-{1,2}[\w-]+(?:=\S+)?(?:\s+[^\s-]\S*)?)*\s+merge\b/g;
const REST_MERGE_INTENT = /\/pulls?\/[^\s/]+\/merge\b/g;
const REST_BRANCH_MERGE_INTENT = /\/merges\b/g;
const GRAPHQL_MERGE_INTENT =
  /\b(?:mergePullRequest|enablePullRequestAutoMerge|enqueuePullRequest|addPullRequestToMergeQueue)\b/g;
const INTENTS = [
  PR_MERGE_INTENT,
  REST_MERGE_INTENT,
  REST_BRANCH_MERGE_INTENT,
  GRAPHQL_MERGE_INTENT,
];
const REST_MERGE_PATH = /pulls?\/([^/\s]+)\/merge\b/;
const REST_REPO_PATH = /repos\/([^/\s]+)\/([^/\s]+)\//;
const PLACEHOLDER_PREFIX = '{';
const PR_NUMBER = /^\d+$/;
const ASSIGNMENT = /^([A-Za-z_]\w*)=(.*)$/;
const REPO_VARIABLE = 'GH_REPO';
const SEPARATORS = new Set([';', '&', '|', '\n', '(', ')', '`']);
const QUOTES = new Set(["'", '"']);
const SHELL_ONLY = new Set(['$', '`']);
const HOME_PREFIX = /^~\/?/;
const PREVIOUS_DIRECTORY = '-';
const PREFIX_WORDS = new Set([
  '{',
  'then',
  'do',
  'else',
  'elif',
  'if',
  'while',
  'until',
  '!',
  'env',
  'command',
  'exec',
  'time',
  'nohup',
  'sudo',
  'export',
]);
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
    if (started) tokens.push({ text: current, dynamic, separator: false });
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
      flush();
      tokens.push({ text: char, dynamic: false, separator: true });
    } else if (/\s/.test(char)) {
      flush();
    } else if (char === '\\') {
      index += 1;
      const escaped = text[index] ?? '';
      if (escaped === '\n') flush();
      else {
        current += escaped;
        started = true;
      }
    } else {
      if (SHELL_ONLY.has(char)) dynamic = true;
      current += char;
      started = true;
    }
  }
  flush();
  return tokens;
};

const normalize = (command) =>
  command
    .replace(/\\\n/g, ' ')
    .replace(/\\(.)/gs, '$1')
    .replace(/["']/g, '')
    .replace(GH_PATH, '$1gh');

const countIntents = (normalized) =>
  INTENTS.reduce((total, pattern) => total + (normalized.match(pattern)?.length ?? 0), 0);

const isGhWord = (token) => !token.separator && (token.text === 'gh' || token.text.endsWith('/gh'));

const isCommandPosition = (tokens, index) => {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const token = tokens[cursor];
    if (token.separator) return true;
    if (!PREFIX_WORDS.has(token.text) && !ASSIGNMENT.test(token.text)) return false;
  }
  return true;
};

const segmentEnd = (tokens, from) => {
  let end = from;
  while (end < tokens.length && !tokens[end].separator) end += 1;
  return end;
};

const repoFlag = (tokens, index) => {
  const [flag, inline] = tokens[index].text.split('=', 2);
  if (!REPO_FLAGS.has(flag)) return undefined;
  const value = inline === undefined ? tokens[index + 1] : { text: inline, dynamic: false };
  return {
    value,
    next: inline === undefined ? index + 2 : index + 1,
  };
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

const restTarget = (tokens) => {
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

const environmentRepo = (tokens, index) => {
  let result = { repo: undefined, resolvable: true };
  for (let cursor = 0; cursor < index; cursor += 1) {
    const match = tokens[cursor].separator ? null : tokens[cursor].text.match(ASSIGNMENT);
    if (match?.[1] !== REPO_VARIABLE) continue;
    result = tokens[cursor].dynamic
      ? { repo: undefined, resolvable: false }
      : { repo: match[2], resolvable: true };
  }
  return result;
};

const directoryBefore = (tokens, index, startDirectory) => {
  let directory = startDirectory;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (tokens[cursor].separator || tokens[cursor].text !== 'cd') continue;
    if (!isCommandPosition(tokens, cursor)) continue;
    const target = tokens[cursor + 1];
    if (target === undefined || target.separator) {
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

const parseInvocation = (tokens, index) => {
  const end = segmentEnd(tokens, index + 1);
  let cursor = index + 1;
  let flagRepo;
  let resolvable = true;
  const readRepoFlags = () => {
    for (let flag = repoFlag(tokens, cursor); flag !== undefined; flag = repoFlag(tokens, cursor)) {
      if (flag.value === undefined || flag.value.dynamic) resolvable = false;
      else flagRepo = flag.value.text;
      cursor = flag.next;
    }
  };
  readRepoFlags();
  const subcommand = tokens[cursor]?.text;
  cursor += 1;
  if (subcommand === 'api') {
    const target = restTarget(tokens.slice(cursor, end));
    return (
      target && {
        ...target,
        repo: flagRepo ?? target.repo,
        resolvable: target.resolvable && resolvable,
      }
    );
  }
  if (subcommand !== 'pr') return undefined;
  readRepoFlags();
  if (tokens[cursor]?.text !== 'merge') return undefined;
  const parsed = parseMerge(tokens.slice(cursor + 1, end));
  return {
    label: parsed.selector ?? 'the current PR',
    ...parsed,
    repo: parsed.repo ?? flagRepo,
    resolvable: parsed.resolvable && resolvable,
  };
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

const normalized = normalize(command);
const intents = countIntents(normalized);
if (intents === 0) process.exit(0);

const tokens = tokenize(command);
const dynamicCommand = tokens.some(
  (token, index) => !token.separator && token.dynamic && isCommandPosition(tokens, index),
);
if (!GH_WORD.test(normalized) && !dynamicCommand) process.exit(0);

let clean = 0;
tokens.forEach((token, index) => {
  if (!isGhWord(token) || !isCommandPosition(tokens, index)) return;
  const invocation = parseInvocation(tokens, index);
  if (invocation === undefined) return;
  clean += 1;
  const directory = directoryBefore(tokens, index, startDirectory);
  const environment = environmentRepo(tokens, index);
  verify({
    ...invocation,
    repo: invocation.repo ?? environment.repo,
    resolvable: invocation.resolvable && environment.resolvable && directory !== undefined,
    directory,
  });
});

if (clean < intents) {
  block(
    'Blocked: this command carries a GitHub merge (a pull request merge, a merge endpoint, a merge mutation or an auto-merge) that does not parse as a single `gh pr merge <selector>` or `gh api .../pulls/<number>/merge` whose base branch can be read. Merging is refused when the command is not understood. The owner merges into main.',
  );
}
