#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { extractDocPaths, findMissingPaths } from './check-doc-drift.mjs';

const HARD = 'HARD';
const WARN = 'WARN';
const GATE_ERROR_EXIT_CODE = 2;
const HARD_FINDING_EXIT_CODE = 1;

const DOC_EXTENSIONS = ['.md', '.mdx'];
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];
const EM_DASH = '\u2014';
const EN_DASH = '\u2013';
const DASHES = [EM_DASH, EN_DASH];
const MIN_LITERAL_LENGTH = 8;
const ALLOWED_LITERALS = new Set([
  'use client',
  'use server',
  'text/html',
  'application/json',
  'multipart/form-data',
  'strict-dynamic',
  'unsafe-inline',
]);
const ALLOWED_NUMBERS = new Set(['0', '1', '-1']);
const DECISIONS_FILE = 'DECISIONS.md';
const TEST_DIRECTORY = /(^|\/)(__tests__|tests)\//;
const TEST_FILE = /\.(test|spec|e2e)\.[cm]?[jt]sx?$/;
const SNAPSHOT_DIRECTORY = /(^|\/)(__snapshots__|snapshots)\//;
const SNAPSHOT_FILE = /\.snap$/;
const SHA_CANDIDATE = /\b[0-9a-f]{7,40}\b/g;
const IMPORT_LINE = /^\s*import\b/;
const EXPORT_FROM_LINE = /\bfrom\s+['"]/;
const MODULE_SPECIFIER = /^(@|\.{1,2}\/|\/)/;
const REGEX_PRECEDING_KEYWORDS = new Set([
  'await',
  'case',
  'delete',
  'do',
  'else',
  'in',
  'instanceof',
  'new',
  'of',
  'return',
  'throw',
  'typeof',
  'void',
  'yield',
]);

let root = process.cwd();
const findings = [];

function git(args, options = {}) {
  const cwd = options.cwd ?? root;
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 512 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (options.allowFail) return null;
    const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
    throw new Error(`git ${args.join(' ')} failed: ${stderr || String(error)}`);
  }
}

function report(level, rule, file, line, hint) {
  findings.push({ level, rule, file, line, hint });
}

function isDocPath(path) {
  return DOC_EXTENSIONS.some((extension) => path.endsWith(extension));
}

function isSourcePath(path) {
  return SOURCE_EXTENSIONS.some((extension) => path.endsWith(extension));
}

function isNoisePath(path) {
  return (
    path === DECISIONS_FILE ||
    TEST_DIRECTORY.test(path) ||
    TEST_FILE.test(path) ||
    SNAPSHOT_DIRECTORY.test(path) ||
    SNAPSHOT_FILE.test(path)
  );
}

function parseDiffPath(raw) {
  const value = raw.split('\t')[0].trim();
  if (value === '/dev/null') return null;
  const unquoted =
    value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1).replace(/\\"/g, '"') : value;
  return unquoted.replace(/^[ab]\//, '');
}

function parseDiff(diffText) {
  const files = new Map();
  let oldPath = null;
  let current = null;
  let newLine = 0;

  for (const raw of diffText.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      oldPath = null;
      current = null;
      newLine = 0;
      continue;
    }
    if (raw.startsWith('--- ')) {
      oldPath = parseDiffPath(raw.slice(4));
      continue;
    }
    if (raw.startsWith('+++ ')) {
      const path = parseDiffPath(raw.slice(4));
      if (path) {
        current = { path, oldPath, added: [], removed: [] };
        files.set(path, current);
      } else {
        current = null;
      }
      newLine = 0;
      continue;
    }
    if (raw.startsWith('@@')) {
      const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      newLine = match ? Number(match[1]) : 0;
      continue;
    }
    if (!current) continue;
    if (raw.startsWith('+')) {
      current.added.push({ line: newLine, text: raw.slice(1) });
      newLine += 1;
      continue;
    }
    if (raw.startsWith('-')) {
      current.removed.push(raw.slice(1));
      continue;
    }
    if (raw.startsWith('\\')) continue;
    newLine += 1;
  }

  return files;
}

function readLines(path) {
  let content;
  try {
    content = readFileSync(path, 'utf8');
  } catch {
    return null;
  }
  if (content.includes('\u0000')) return null;
  const lines = content.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function countDashes(text) {
  let count = 0;
  for (const dash of DASHES) {
    if (dash === EM_DASH) {
      count += text.split(EM_DASH).length - 1;
    } else {
      count += text.split(EN_DASH).length - 1;
    }
  }
  return count;
}

const shaCache = new Map();

function resolveCommit(token) {
  if (shaCache.has(token)) return shaCache.get(token);
  const resolved = git(['rev-parse', '--verify', '--quiet', `${token}^{commit}`], {
    allowFail: true,
  });
  if (!resolved) {
    shaCache.set(token, null);
    return null;
  }
  const full = resolved.trim();
  const ancestor = git(['merge-base', '--is-ancestor', full, 'HEAD'], { allowFail: true }) !== null;
  shaCache.set(token, { full, ancestor });
  return shaCache.get(token);
}

function forEachStaleSha(text, onFound) {
  SHA_CANDIDATE.lastIndex = 0;
  let match = SHA_CANDIDATE.exec(text);
  while (match !== null) {
    const token = match[0];
    if (/[0-9]/.test(token) && /[a-f]/.test(token)) {
      const info = resolveCommit(token);
      if (info !== null && !info.ancestor) onFound(token, info.full);
    }
    match = SHA_CANDIDATE.exec(text);
  }
}

function endsRegexLiteral(line, start) {
  let index = start + 1;
  let inCharacterClass = false;
  while (index < line.length) {
    const character = line[index];
    if (character === '\\') {
      index += 2;
      continue;
    }
    if (character === '[') inCharacterClass = true;
    else if (character === ']') inCharacterClass = false;
    else if (character === '/' && !inCharacterClass) return index;
    else if (character === '\n') return -1;
    index += 1;
  }
  return -1;
}

function startsRegexLiteral(line, start) {
  let index = start - 1;
  while (index >= 0 && /\s/.test(line[index])) index -= 1;
  if (index < 0) return true;
  const previous = line[index];
  if ('(,=:[!&|?{};+-*%<>^~'.includes(previous)) return true;
  const word = /([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(line.slice(0, index + 1));
  if (word === null) return false;
  return REGEX_PRECEDING_KEYWORDS.has(word[1]);
}

function scanLineForLiterals(line) {
  const strings = [];
  const numbers = [];
  let index = 0;

  while (index < line.length) {
    const character = line[index];
    if (character === '/' && line[index + 1] === '/') break;
    if (character === '/' && line[index + 1] === '*') {
      const end = line.indexOf('*/', index + 2);
      index = end === -1 ? line.length : end + 2;
      continue;
    }
    if (character === '/' && startsRegexLiteral(line, index)) {
      const end = endsRegexLiteral(line, index);
      index = end === -1 ? line.length : end + 1;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      const quote = character;
      let cursor = index + 1;
      let value = '';
      while (cursor < line.length && line[cursor] !== quote) {
        if (line[cursor] === '\\') {
          value += line[cursor + 1] ?? '';
          cursor += 2;
          continue;
        }
        value += line[cursor];
        cursor += 1;
      }
      if (quote !== '`') strings.push(value);
      index = cursor + 1;
      continue;
    }
    if (character >= '0' && character <= '9') {
      const previous = line[index - 1];
      const isIndex = previous === '[';
      if (!isIndex && (previous === undefined || !/[A-Za-z_$]/.test(previous))) {
        const match = /^[0-9]+(?:\.[0-9]+)?/.exec(line.slice(index));
        if (match) {
          numbers.push(match[0]);
          index += match[0].length;
          continue;
        }
      }
    }
    index += 1;
  }

  return { strings, numbers };
}

function main() {
  const toplevel = git(['rev-parse', '--show-toplevel']);
  root = resolve(toplevel.trim());

  const baseRef = process.env.PR_BASE ?? 'origin/main';
  const baseSha = git(['rev-parse', '--verify', `${baseRef}^{commit}`], { allowFail: true });
  if (!baseSha) {
    console.error(`[pre-pr] GATE ERROR: cannot resolve the base ref "${baseRef}".`);
    console.error('[pre-pr] Set PR_BASE to a commit or ref that exists in this repository.');
    process.exit(GATE_ERROR_EXIT_CODE);
  }
  const headSha = git(['rev-parse', '--verify', 'HEAD^{commit}'], { allowFail: true });
  if (!headSha) {
    console.error('[pre-pr] GATE ERROR: cannot resolve HEAD.');
    process.exit(GATE_ERROR_EXIT_CODE);
  }

  const status = git(['status', '--porcelain', '--untracked-files=all'], { allowFail: true }) ?? '';
  if (headSha.trim() === baseSha.trim() && status.trim() === '') {
    console.log('[pre-pr] skipped: HEAD equals the base ref and the working tree is clean.');
    process.exit(0);
  }

  const mergeBase = git(['merge-base', baseSha.trim(), headSha.trim()], { allowFail: true });
  const base = mergeBase ? mergeBase.trim() : baseSha.trim();

  const diffText = git(['diff', '--no-color', '--no-ext-diff', '-M', '--unified=0', base, '--']);
  const nameStatus = git([
    'diff',
    '--no-color',
    '--no-ext-diff',
    '-M',
    '--name-status',
    base,
    '--',
  ]);
  const untracked = (
    git(['ls-files', '--others', '--exclude-standard', '-z'], { allowFail: true }) ?? ''
  )
    .split('\u0000')
    .filter((entry) => entry !== '');

  const files = parseDiff(diffText);
  for (const path of untracked) {
    const lines = readLines(join(root, path));
    if (lines === null) continue;
    files.set(path, {
      path,
      oldPath: null,
      added: lines.map((text, index) => ({ line: index + 1, text })),
      removed: [],
    });
  }

  const changedPaths = new Set();
  for (const line of nameStatus.split('\n')) {
    const parts = line.split('\t');
    if (parts.length >= 3) {
      changedPaths.add(parts[1]);
      changedPaths.add(parts[2]);
    } else if (parts.length === 2) {
      changedPaths.add(parts[1]);
    }
  }
  for (const path of untracked) changedPaths.add(path);

  for (const file of files.values()) {
    if (file.oldPath) changedPaths.add(file.oldPath);
  }

  const rootEntries = new Set(readdirSync(root));

  function isDirectory(candidate) {
    try {
      return readdirSync(join(root, candidate)).length >= 0 && existsSync(join(root, candidate));
    } catch {
      return false;
    }
  }

  function isPathCandidate(candidate) {
    if (candidate.startsWith('./') || candidate.startsWith('../')) return true;
    const segments = candidate.split('/').filter((segment) => segment !== '');
    if (segments.length < 2) return false;
    if (!rootEntries.has(segments[0])) return false;
    const last = segments[segments.length - 1];
    if (last.includes('.') || candidate.endsWith('/')) return true;
    return isDirectory(candidate);
  }

  function pathExists(candidate, docDir) {
    if (candidate.startsWith('./') || candidate.startsWith('../')) {
      return existsSync(resolve(docDir, candidate));
    }
    return existsSync(join(root, candidate)) || existsSync(resolve(docDir, candidate));
  }

  function existsAtHead(candidate) {
    if (candidate.startsWith('./') || candidate.startsWith('../')) return false;
    return git(['cat-file', '-e', `HEAD:${candidate}`], { allowFail: true }) !== null;
  }

  for (const file of files.values()) {
    const addedDash = file.added.reduce((total, entry) => total + countDashes(entry.text), 0);
    const removedDash = file.removed.reduce((total, text) => total + countDashes(text), 0);
    if (addedDash > removedDash) {
      const first = file.added.find((entry) => countDashes(entry.text) > 0);
      const kind = first?.text.includes(EM_DASH) ? 'em dash (U+2014)' : 'en dash (U+2013)';
      report(
        HARD,
        'dash',
        file.path,
        first ? first.line : 0,
        `net-new ${kind} on this line; write a plain hyphen, a colon, or a comma instead`,
      );
    }
  }

  for (const file of files.values()) {
    if (!isDocPath(file.path)) continue;
    const docDir = dirname(join(root, file.path));
    for (const entry of file.added) {
      for (const candidate of extractDocPaths([entry.text], entry.line)) {
        if (!isPathCandidate(candidate.path)) continue;
        const missing = findMissingPaths(
          [candidate.path],
          (value) => pathExists(value, docDir) || existsAtHead(value),
        );
        if (missing.length === 0) continue;
        report(
          HARD,
          'missing-path',
          file.path,
          candidate.line,
          `path ${missing[0]} does not exist; create it or fix the reference`,
        );
      }
    }
  }

  for (const file of files.values()) {
    if (!isDocPath(file.path)) continue;
    for (const entry of file.added) {
      forEachStaleSha(entry.text, (token) => {
        report(
          HARD,
          'stale-sha',
          file.path,
          entry.line,
          `cited commit ${token.slice(0, 7)} is not in the history of HEAD; cite a reachable commit`,
        );
      });
    }
  }

  const log = git(['log', '--format=%H%x1f%B%x1e', `${baseSha.trim()}..${headSha.trim()}`], {
    allowFail: true,
  });
  for (const record of (log ?? '').split('\u001e')) {
    const trimmed = record.replace(/^\n+/, '');
    if (trimmed.trim() === '') continue;
    const separator = trimmed.indexOf('\u001f');
    if (separator === -1) continue;
    const commit = trimmed.slice(0, separator).trim();
    const body = trimmed.slice(separator + 1);
    body.split('\n').forEach((line, index) => {
      forEachStaleSha(line, (token) => {
        report(
          HARD,
          'stale-sha',
          `commit ${commit.slice(0, 7)}`,
          index + 1,
          `cited commit ${token.slice(0, 7)} is not in the history of HEAD; cite a reachable commit`,
        );
      });
    });
  }

  const trackedDocs = (git(['ls-files', '--', '*.md', '*.mdx'], { allowFail: true }) ?? '')
    .split('\n')
    .filter((path) => path !== '' && !isNoisePath(path) && !changedPaths.has(path));
  const changedSet = new Set([...changedPaths].filter((path) => !isNoisePath(path)));

  for (const path of trackedDocs) {
    const lines = readLines(join(root, path));
    if (lines === null) continue;
    for (const candidate of extractDocPaths(lines)) {
      if (!isPathCandidate(candidate.path)) continue;
      const normalized = candidate.path.replace(/^\.\//, '');
      if (!changedSet.has(normalized)) continue;
      report(
        WARN,
        'doc-drift',
        path,
        candidate.line,
        `mentions ${normalized}, which this branch changes, but was not updated; update it or confirm no update is needed`,
      );
    }
  }

  const literals = new Map();
  for (const file of files.values()) {
    if (!isSourcePath(file.path)) continue;
    if (isNoisePath(file.path)) continue;
    for (const entry of file.added) {
      if (IMPORT_LINE.test(entry.text) || EXPORT_FROM_LINE.test(entry.text)) continue;
      const { strings, numbers } = scanLineForLiterals(entry.text);
      for (const value of strings) {
        if (value.length < MIN_LITERAL_LENGTH) continue;
        if (ALLOWED_LITERALS.has(value) || MODULE_SPECIFIER.test(value)) continue;
        const key = `string:${value}`;
        const bucket = literals.get(key) ?? [];
        bucket.push({ file: file.path, line: entry.line });
        literals.set(key, bucket);
      }
      for (const value of numbers) {
        if (ALLOWED_NUMBERS.has(value)) continue;
        const key = `number:${value}`;
        const bucket = literals.get(key) ?? [];
        bucket.push({ file: file.path, line: entry.line });
        literals.set(key, bucket);
      }
    }
  }

  for (const [key, occurrences] of literals) {
    const distinctFiles = [...new Set(occurrences.map((occurrence) => occurrence.file))];
    if (distinctFiles.length < 2) continue;
    const value = key.slice(key.indexOf(':') + 1);
    const first = occurrences[0];
    const others = distinctFiles.filter((file) => file !== first.file).join(', ');
    report(
      WARN,
      'duplicate-literal',
      first.file,
      first.line,
      `literal ${JSON.stringify(value)} is also added in ${others}; give it one shared home if it carries meaning`,
    );
  }

  const hard = findings.filter((finding) => finding.level === HARD);
  const warnings = findings.filter((finding) => finding.level === WARN);

  for (const finding of findings) {
    console.log(
      `[pre-pr] ${finding.level} ${finding.rule} ${finding.file}:${finding.line} ${finding.hint}`,
    );
  }

  if (hard.length === 0) {
    console.log(`[pre-pr] OK: no hard findings (0 hard, ${warnings.length} warnings).`);
    process.exit(0);
  }

  console.log(`[pre-pr] FAILED: ${hard.length} hard finding(s), ${warnings.length} warning(s).`);
  process.exit(HARD_FINDING_EXIT_CODE);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[pre-pr] GATE ERROR: ${message}`);
  process.exit(GATE_ERROR_EXIT_CODE);
}
