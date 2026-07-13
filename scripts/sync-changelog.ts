#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type ChangelogGroups,
  mergeChangelogGroups,
  parseChangelogGroups,
  renderChangelogGroups,
} from './lib/changelog-merge';

const ROOT = join(import.meta.dirname, '..');
const CHANGELOG_PATH = join(ROOT, 'app/design-system/changelog/page.mdx');

const HEADER = `import { dsPageMetadata } from '../_lib/page-metadata';
import { Breadcrumb } from '../_components/Breadcrumb';

export const metadata = dsPageMetadata({
  slug: 'changelog',
  title: 'Changelog — Design System — erikunha.dev',
  description: 'Design system token and component changelog',
});

<Breadcrumb trail={[
  { name: 'Home', path: '/' },
  { name: 'Design System', path: '/design-system' },
  { name: 'Changelog', path: '/design-system/changelog' },
]} />

# CHANGELOG

`;

function parseCommits(): ChangelogGroups {
  const raw = execFileSync('git', ['log', '--format=%ad|%s', '--date=short', '--no-merges'], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  const groups: ChangelogGroups = new Map();

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

const existing = parseChangelogGroups(readFileSync(CHANGELOG_PATH, 'utf8'));
const merged = mergeChangelogGroups(existing, parseCommits());
const content = `${HEADER}${renderChangelogGroups(merged)}\n`;
writeFileSync(CHANGELOG_PATH, content);
console.log(`changelog: wrote ${merged.size} date group(s) to ${CHANGELOG_PATH}`);
