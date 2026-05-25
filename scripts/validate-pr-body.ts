#!/usr/bin/env tsx
// Usage: pnpm validate-pr-body [<pr-number>]
//
// Checks that a PR body fills every section from .github/pull_request_template.md.
// A section is considered filled when:
//   - its ## heading is present in the body, AND
//   - at least one non-comment, non-empty line follows before the next ## heading
//
// Exits 0 on pass, 1 on any violation.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

  // Collect lines until next ## heading
  const contentLines: string[] = [];
  for (let i = headingIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.trim().startsWith('## ')) break;
    contentLines.push(line);
  }

  // Strip closed <!-- ... --> blocks, then any unclosed <!-- to end of content.
  // Two-pass prevents CodeQL "incomplete multi-character sanitization" (an
  // unclosed opener would leave "<!--" in the output after the first pass).
  const stripped = contentLines
    .join('\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!--[\s\S]*/g, '');

  const meaningful = stripped.split('\n').filter((l) => {
    const t = l.trim();
    if (!t) return false;
    // Any unchecked checkbox (with or without trailing text) is placeholder.
    // Only a checked box "- [x]" or plain non-checkbox text counts as filled.
    if (/^-\s*\[\s*\]/.test(t)) return false;
    // Bare bullet with no content is placeholder (e.g. lone "-" in Summary)
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
    process.stderr.write(
      `${C.red}[validate-pr-body] Could not fetch PR body.${C.reset} Are you on a PR branch? (${err})\n`,
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

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) main();
