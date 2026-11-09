export const CHANGELOG_KINDS = ['Added', 'Changed', 'Fixed'] as const;
export type ChangelogKind = (typeof CHANGELOG_KINDS)[number];
export type ChangelogEntry = { kind: ChangelogKind; description: string; breaking: boolean };
export type ChangelogGroups = Map<string, ChangelogEntry[]>;

const COMMIT_TYPE_KIND: Readonly<Record<string, ChangelogKind>> = {
  feat: 'Added',
  fix: 'Fixed',
};
const DEFAULT_KIND: ChangelogKind = 'Changed';

export function commitTypeToKind(type: string): ChangelogKind {
  return COMMIT_TYPE_KIND[type] ?? DEFAULT_KIND;
}

const DASH_RUN = /\s*[–—]\s*/g;
const DASH_REPLACEMENT = ': ';
const REFERENCE_SUFFIX = /\s*\((?:#\d+|T\d+[^)]*|PR-\w+)\)/g;
const BREAKING_PREFIX = 'Breaking: ';

const plainDashes = (text: string): string => text.replace(DASH_RUN, DASH_REPLACEMENT);

export function humanizeDescription(description: string): string {
  const text = plainDashes(description).replace(REFERENCE_SUFFIX, '').trim();
  return text.replace(/^[a-z](?=[^\s\d/]*(?:\s|$))/, (letter) => letter.toUpperCase());
}

export const CHANGELOG_HEADER = `import { dsPageMetadata } from '../_lib/page-metadata';
import { OnThisPage } from '../_components/OnThisPage';

export const metadata = dsPageMetadata({
  slug: 'changelog',
  title: 'Changelog · Design System · erikunha.dev',
  description: 'Design system token and component changelog',
});

# CHANGELOG

`;

const DATE_HEADING = /^(?:## |<h2 id="[\d-]+">)(\d{4}-\d{2}-\d{2})(?:<\/h2>)?\s*$/;
const KIND_HEADING = /^### (Added|Changed|Fixed)\s*$/;
const LEGACY_ENTRY_LINE = /^- \*\*(\w+)(!)?:\*\* (.+)$/;
const ENTRY_LINE = /^- (.+)$/;

export function parseChangelogGroups(mdx: string): ChangelogGroups {
  const groups: ChangelogGroups = new Map();
  let currentDate: string | null = null;
  let currentKind: ChangelogKind = DEFAULT_KIND;
  for (const line of mdx.split('\n')) {
    const date = line.match(DATE_HEADING);
    if (date?.[1]) {
      currentDate = date[1];
      currentKind = DEFAULT_KIND;
      if (!groups.has(currentDate)) groups.set(currentDate, []);
      continue;
    }
    if (!currentDate) continue;
    const kind = line.match(KIND_HEADING);
    if (kind?.[1]) {
      currentKind = kind[1] as ChangelogKind;
      continue;
    }
    const legacy = line.match(LEGACY_ENTRY_LINE);
    if (legacy?.[1] && legacy[3]) {
      groups.get(currentDate)?.push({
        kind: commitTypeToKind(legacy[1]),
        description: legacy[3],
        breaking: legacy[2] === '!',
      });
      continue;
    }
    const entry = line.match(ENTRY_LINE);
    if (entry?.[1]) {
      const breaking = entry[1].startsWith(BREAKING_PREFIX);
      groups.get(currentDate)?.push({
        kind: currentKind,
        description: breaking ? entry[1].slice(BREAKING_PREFIX.length) : entry[1],
        breaking,
      });
    }
  }
  for (const [date, entries] of groups) {
    if (entries.length === 0) groups.delete(date);
  }
  return groups;
}

export function mergeChangelogGroups(
  existing: ChangelogGroups,
  fromGit: ChangelogGroups,
): ChangelogGroups {
  const merged: ChangelogGroups = new Map();
  const clean = (entry: ChangelogEntry): ChangelogEntry => ({
    ...entry,
    description: humanizeDescription(entry.description),
  });
  for (const [date, entries] of existing) merged.set(date, entries.map(clean));
  for (const [date, entries] of fromGit) {
    const target = merged.get(date) ?? [];
    if (!merged.has(date)) merged.set(date, target);
    const entryKey = (e: ChangelogEntry) => `${e.kind}:${e.breaking}:${e.description}`;
    const seen = new Set(target.map(entryKey));
    for (const entry of entries.map(clean)) {
      const key = entryKey(entry);
      if (!seen.has(key)) {
        target.push(entry);
        seen.add(key);
      }
    }
  }
  return merged;
}

const sortedDates = (groups: ChangelogGroups): string[] =>
  [...groups.keys()].sort((a, b) => b.localeCompare(a));

export function renderChangelogGroups(groups: ChangelogGroups): string {
  return sortedDates(groups)
    .map((date) => {
      const entries = groups.get(date) ?? [];
      const sections = CHANGELOG_KINDS.flatMap((kind) => {
        const items = entries
          .filter((entry) => entry.kind === kind)
          .map(
            ({ description, breaking }) =>
              `- ${breaking ? BREAKING_PREFIX : ''}${humanizeDescription(description)}`,
          );
        return items.length > 0 ? [`### ${kind}\n\n${items.join('\n')}`] : [];
      });
      return `<h2 id="${date}">${date}</h2>\n\n${sections.join('\n\n')}`;
    })
    .join('\n\n');
}

export function renderChangelogToc(groups: ChangelogGroups): string {
  const items = sortedDates(groups).map((date) => `{id:'${date}',label:'${date}'}`);
  return `<OnThisPage items={[${items.join(',')}]} />`;
}

export const CHANGELOG_INTRO =
  'Design system changes by date, newest first, grouped as Added, Changed and Fixed.';

export function renderChangelogPage(groups: ChangelogGroups): string {
  return `${CHANGELOG_HEADER}${renderChangelogToc(groups)}\n\n${CHANGELOG_INTRO}\n\n${renderChangelogGroups(groups)}\n`;
}
