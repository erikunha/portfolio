#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CHANGELOG_PATH = join(import.meta.dirname, '../app/design-system/changelog/page.mdx');

const HEADER = `export const metadata = {
  title: 'Changelog — Design System — erikunha.dev',
  description: 'Design system token and component changelog',
};

# CHANGELOG

`;

type Entry = { type: string; description: string };
type GroupedByDate = Map<string, Entry[]>;

function parseCommits(): GroupedByDate {
  const raw = execFileSync('git', [
    'log',
    '--format=%ad|%s',
    '--date=short',
    '--no-merges',
  ]).toString();

  const groups: GroupedByDate = new Map();

  for (const line of raw.split('\n')) {
    const sep = line.indexOf('|');
    if (sep === -1) continue;
    const date = line.slice(0, sep);
    const subject = line.slice(sep + 1);

    const match = subject.match(/^(\w+)\(design-system\):\s+(.+)$/);
    if (!match) continue;

    const type = match[1];
    const description = match[2];
    if (!type || !description) continue;
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)?.push({ type, description });
  }

  return groups;
}

function renderGroups(groups: GroupedByDate): string {
  const dates = [...groups.keys()].sort((a, b) => b.localeCompare(a));
  return dates
    .map((date) => {
      const entries = groups.get(date) ?? [];
      const items = entries
        .map(({ type, description }) => `- **${type}:** ${description}`)
        .join('\n');
      return `## ${date}\n\n${items}`;
    })
    .join('\n\n');
}

const groups = parseCommits();
const content = `${HEADER}${renderGroups(groups)}\n`;
writeFileSync(CHANGELOG_PATH, content);
console.log(`changelog: wrote ${groups.size} date group(s) to ${CHANGELOG_PATH}`);
