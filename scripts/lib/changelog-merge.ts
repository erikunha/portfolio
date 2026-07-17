export type ChangelogEntry = { type: string; description: string; breaking: boolean };
export type ChangelogGroups = Map<string, ChangelogEntry[]>;

const DATE_HEADING = /^## (\d{4}-\d{2}-\d{2})\s*$/;
const ENTRY_LINE = /^- \*\*(\w+)(!)?:\*\* (.+)$/;

export function parseChangelogGroups(mdx: string): ChangelogGroups {
  const groups: ChangelogGroups = new Map();
  let currentDate: string | null = null;
  for (const line of mdx.split('\n')) {
    const date = line.match(DATE_HEADING);
    if (date?.[1]) {
      currentDate = date[1];
      if (!groups.has(currentDate)) groups.set(currentDate, []);
      continue;
    }
    if (!currentDate) continue;
    const entry = line.match(ENTRY_LINE);
    if (entry?.[1] && entry[3]) {
      groups.get(currentDate)?.push({
        type: entry[1],
        description: entry[3],
        breaking: entry[2] === '!',
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
  for (const [date, entries] of existing) merged.set(date, [...entries]);
  for (const [date, entries] of fromGit) {
    const target = merged.get(date) ?? [];
    if (!merged.has(date)) merged.set(date, target);
    const entryKey = (e: ChangelogEntry) => `${e.type}:${e.breaking}:${e.description}`;
    const seen = new Set(target.map(entryKey));
    for (const entry of entries) {
      const key = entryKey(entry);
      if (!seen.has(key)) {
        target.push(entry);
        seen.add(key);
      }
    }
  }
  return merged;
}

export function renderChangelogGroups(groups: ChangelogGroups): string {
  const dates = [...groups.keys()].sort((a, b) => b.localeCompare(a));
  return dates
    .map((date) => {
      const items = (groups.get(date) ?? [])
        .map(
          ({ type, description, breaking }) =>
            `- **${type}${breaking ? '!' : ''}:** ${description}`,
        )
        .join('\n');
      return `## ${date}\n\n${items}`;
    })
    .join('\n\n');
}
