#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const BOT_AUTHORS_TO_SKIP = new Set([
  'vercel',
  'vercel[bot]',
  'github-actions',
  'github-actions[bot]',
]);

const NOISE_BODY_MARKERS = [/^\[vc\]: #/m, /Vercel for GitHub/i];

function usage() {
  console.error('Usage: pnpm pr:comments <PR-number> [--repo owner/name]');
  console.error('  Defaults --repo to the current git remote `origin`.');
  process.exit(2);
}

function ghJson(endpoint) {
  const raw = execFileSync('gh', ['api', '--paginate', '--slurp', endpoint], {
    encoding: 'utf-8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
    return parsed.flat();
  }
  if (Array.isArray(parsed) && parsed.length === 1) {
    return parsed[0];
  }
  return parsed;
}

function isNoise(comment) {
  if (BOT_AUTHORS_TO_SKIP.has(comment.user?.login)) return true;
  const body = comment.body ?? '';
  return NOISE_BODY_MARKERS.some((re) => re.test(body));
}

function indent(text, prefix = '  > ') {
  return text
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
}

function detectRepo() {
  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
      encoding: 'utf-8',
    }).trim();
    const m = remote.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?$/);
    if (!m) return null;
    return `${m[1]}/${m[2]}`;
  } catch {
    return null;
  }
}

const args = process.argv.slice(2);
let prNumber = null;
let repo = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--repo' && args[i + 1]) {
    repo = args[i + 1];
    i++;
  } else if (/^\d+$/.test(a)) {
    prNumber = a;
  } else {
    usage();
  }
}
if (!prNumber) usage();
if (!repo) repo = detectRepo();
if (!repo) {
  console.error('Could not detect repo from git origin. Pass --repo owner/name.');
  process.exit(2);
}

const reviewComments = ghJson(`/repos/${repo}/pulls/${prNumber}/comments`);
const issueComments = ghJson(`/repos/${repo}/issues/${prNumber}/comments`);
const pr = ghJson(`/repos/${repo}/pulls/${prNumber}`);

const filteredReviews = reviewComments.filter((c) => !isNoise(c));
const filteredIssues = issueComments.filter((c) => !isNoise(c));

const byFile = new Map();
for (const c of filteredReviews) {
  const file = c.path ?? '(unknown file)';
  const bucket = byFile.get(file) ?? [];
  bucket.push(c);
  byFile.set(file, bucket);
}

const sortedFiles = [...byFile.keys()].sort();
const fetchedAt = new Date().toISOString();

console.log(`# PR #${prNumber} review surface — ${pr.title}\n`);
console.log(`- Repo: \`${repo}\``);
console.log(`- State: \`${pr.state}\` · base: \`${pr.base.ref}\` ← head: \`${pr.head.ref}\``);
console.log(`- Fetched at: ${fetchedAt}`);
console.log(
  `- Inline review comments: ${filteredReviews.length} (${reviewComments.length - filteredReviews.length} filtered as bot noise)`,
);
console.log(
  `- Top-level issue comments: ${filteredIssues.length} (${issueComments.length - filteredIssues.length} filtered as bot noise)`,
);
console.log('');

console.log('## Per-file inline review comments\n');
if (sortedFiles.length === 0) {
  console.log('_(none)_\n');
}
const lineKey = (c) => c.line ?? c.original_line ?? Number.MAX_SAFE_INTEGER;
for (const file of sortedFiles) {
  const comments = byFile.get(file) ?? [];
  console.log(`### \`${file}\` (${comments.length})\n`);
  const sorted = comments.sort((a, b) => {
    const delta = lineKey(a) - lineKey(b);
    if (delta !== 0) return delta;
    return (a.created_at ?? '').localeCompare(b.created_at ?? '');
  });
  for (const c of sorted) {
    const line = c.line ?? c.original_line ?? '?';
    const author = c.user?.login ?? '(unknown)';
    const created = (c.created_at ?? '').slice(0, 10);
    const url = c.html_url ?? '';
    console.log(`- [ ] **Line ${line}** by @${author} (${created})`);
    if (url) console.log(`  - ${url}`);
    console.log(indent((c.body ?? '').trim()));
    console.log('');
  }
}

console.log('## Top-level issue comments\n');
if (filteredIssues.length === 0) {
  console.log('_(none after filtering deployment-bot noise)_\n');
}
for (const c of filteredIssues) {
  const author = c.user?.login ?? '(unknown)';
  const created = (c.created_at ?? '').slice(0, 10);
  console.log(`- [ ] **@${author}** (${created})`);
  if (c.html_url) console.log(`  - ${c.html_url}`);
  console.log(indent((c.body ?? '').trim()));
  console.log('');
}

console.log(
  '> Workflow: resolve each `[ ]` either by (a) fixing the code at Principal/Staff level and replying with the fix SHA, or (b) escalating to the repo owner with a "Why not" rationale. Unresolved threads block merge.',
);
