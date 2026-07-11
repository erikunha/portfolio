#!/usr/bin/env tsx

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  dim: '\x1b[2m',
};

function getTemplateHeadings(): string[] {
  const templatePath = resolve(process.cwd(), '.github/pull_request_template.md');
  let template: string;
  try {
    template = readFileSync(templatePath, 'utf8');
  } catch {
    process.stderr.write(
      `${C.red}[validate-pr-body] Template not found:${C.reset} ${templatePath}\n` +
        `${C.dim}Run this script from the repo root where .github/pull_request_template.md exists.${C.reset}\n`,
    );
    process.exit(1);
  }
  return template
    .split('\n')
    .filter((l) => l.startsWith('## '))
    .map((l) => l.replace(/^## /, '').trim());
}

function getPrBody(prArg: string | undefined): string {
  const args = prArg ? ['pr', 'view', prArg, '--json', 'body'] : ['pr', 'view', '--json', 'body'];
  const raw = execFileSync('gh', args, { encoding: 'utf8' });
  return (JSON.parse(raw) as { body: string }).body ?? '';
}

export function isSectionFilled(heading: string, body: string): boolean {
  const lines = body.split('\n');
  const headingIdx = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (headingIdx === -1) return false;

  const contentLines: string[] = [];
  for (let i = headingIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.trim().startsWith('## ')) break;
    contentLines.push(line);
  }

  const withoutComments: string[] = [];
  let inComment = false;
  for (const rawLine of contentLines) {
    let cur = rawLine;
    if (inComment) {
      const end = cur.indexOf('-->');
      if (end === -1) continue;
      inComment = false;
      cur = cur.slice(end + 3);
    }
    while (cur.includes('<!--')) {
      const start = cur.indexOf('<!--');
      const end = cur.indexOf('-->', start);
      if (end === -1) {
        cur = cur.slice(0, start);
        inComment = true;
        break;
      }
      cur = cur.slice(0, start) + cur.slice(end + 3);
    }
    withoutComments.push(cur);
  }

  const meaningful = withoutComments.filter((l) => {
    const t = l.trim();
    if (!t) return false;
    if (/^-\s*\[\s*\]/.test(t)) return false;
    if (/^-\s*$/.test(t)) return false;
    return true;
  });

  return meaningful.length > 0;
}

function main() {
  const prArg = process.argv[2];

  let body: string;
  try {
    body = getPrBody(prArg);
  } catch (err) {
    const code = (err as { code?: string }).code;
    const stderr = (err as { stderr?: Buffer | string }).stderr?.toString() ?? '';
    let hint: string;
    if (code === 'ENOENT') {
      hint = '`gh` CLI not found — install from https://cli.github.com.';
    } else if (stderr.includes('not logged') || stderr.includes('authentication')) {
      hint = 'Not authenticated — run `gh auth login` then retry.';
    } else if (stderr.includes('no pull requests') || stderr.includes('Could not resolve')) {
      hint = 'No open PR for this branch. Pass a number: pnpm validate-pr-body <pr-number>.';
    } else {
      hint = 'Are you on a PR branch? Run `gh auth status` to check authentication.';
    }
    process.stderr.write(
      `${C.red}[validate-pr-body] Could not fetch PR body.${C.reset} ${hint}\n${C.dim}(${err})${C.reset}\n`,
    );
    process.exit(1);
  }

  const headings = getTemplateHeadings();
  const failures: string[] = [];

  for (const heading of headings) {
    if (!isSectionFilled(heading, body)) {
      failures.push(heading);
    }
  }

  if (failures.length === 0) {
    process.stdout.write(
      `${C.green}${C.bold}[validate-pr-body] PASS${C.reset} — all template sections are filled.\n`,
    );
    process.exit(0);
  } else {
    process.stderr.write(
      `\n${C.red}${C.bold}[validate-pr-body] FAIL${C.reset} — ${failures.length} template section(s) missing or empty:\n`,
    );
    for (const f of failures) {
      process.stderr.write(`  ${C.yellow}•${C.reset} ## ${f}\n`);
    }
    process.stderr.write(
      `\n${C.dim}Fill every section from .github/pull_request_template.md before opening a PR.${C.reset}\n\n`,
    );
    process.exit(1);
  }
}

const isMain =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
