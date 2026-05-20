#!/usr/bin/env node
// scripts/inspect-pr-comments.mjs
//
// PR review surface harness. Fetches the comments on a GitHub PR — both
// in-line review comments (per-file, per-line) and top-level issue
// comments — and renders a structured markdown checklist sorted by file.
//
// Workflow (per CLAUDE.md "PR review quality gate" feedback memory):
//   1. Run `pnpm pr:comments <PR-number>` to dump the review surface.
//   2. For each unresolved thread, either:
//        a) resolve it at Principal/Staff level (fix the code, reply
//           on the thread with the fix SHA + a 1-2 sentence rationale),
//        b) flag to Erik with a "Why not" analysis (why the comment is
//           wrong, decline, or out of scope).
//   3. Unaddressed comments block merge.
//
// Auth: uses `gh` CLI under the hood (must be authenticated).
// Filters: drops common deployment-bot noise (Vercel status comments,
// CI status updates) so the human signal-to-noise ratio is high.
//
// Usage:
//   pnpm pr:comments 29
//   pnpm pr:comments 29 > docs/reviews/PR-29.md   # capture to disk

import { execFileSync } from 'node:child_process';

const BOT_AUTHORS_TO_SKIP = new Set([
  'vercel',
  'vercel[bot]',
  'github-actions',
  'github-actions[bot]',
]);

// Phrases that mark a comment as deployment-status noise, even when the
// author isn't on the skip list (Vercel's GitHub App posts under "vercel"
// AND historically under a personal account in some configs).
const NOISE_BODY_MARKERS = [/^\[vc\]: #/m, /Vercel for GitHub/i];

function usage() {
  console.error('Usage: pnpm pr:comments <PR-number> [--repo owner/name]');
  console.error('  Defaults --repo to the current git remote `origin`.');
  process.exit(2);
}

function ghJson(endpoint) {
  // `gh api` handles pagination via --paginate. Output is concatenated JSON
  // arrays on stdout — combine them into one flat array before parsing.
  const raw = execFileSync('gh', ['api', '--paginate', endpoint], {
    encoding: 'utf-8',
    maxBuffer: 32 * 1024 * 1024,
  });
  // `--paginate` outputs each page as its own JSON; the simplest robust
  // approach is to split-and-merge by trying to parse each top-level array.
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    // Most endpoints — concat array pages. Find each `][` boundary and
    // splice.
    const pages = trimmed.split(/\]\s*\[/);
    if (pages.length === 1) return JSON.parse(trimmed);
    const merged = [];
    for (let i = 0; i < pages.length; i++) {
      let chunk = pages[i];
      if (i > 0) chunk = `[${chunk}`;
      if (i < pages.length - 1) chunk = `${chunk}]`;
      for (const item of JSON.parse(chunk)) merged.push(item);
    }
    return merged;
  }
  return JSON.parse(trimmed);
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
    // Supports git@github.com:owner/repo.git, https://github.com/owner/repo.git
    const m = remote.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?$/);
    if (!m) return null;
    return `${m[1]}/${m[2]}`;
  } catch {
    return null;
  }
}

// --- CLI ---
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

// Group inline review comments by file path.
/** @type {Map<string, Array<typeof reviewComments[number]>>} */
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
for (const file of sortedFiles) {
  const comments = byFile.get(file) ?? [];
  console.log(`### \`${file}\` (${comments.length})\n`);
  for (const c of comments.sort((a, b) => (a.line ?? 0) - (b.line ?? 0))) {
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
  '> Workflow: resolve each `[ ]` either by (a) fixing the code at Principal/Staff level and replying with the fix SHA, or (b) flagging to Erik with a "Why not" rationale. Unresolved threads block merge — see CLAUDE.md feedback memory `pr_review_quality_gate`.',
);
