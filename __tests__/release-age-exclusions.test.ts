import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const REMOVAL_DATE =
  /minimumReleaseAgeExclude:\s*(\S+)[^\n]*?remove on or after (\d{4}-\d{2}-\d{2})/g;

function exclusionProblems(entries: readonly string[], decisions: string, today: string): string[] {
  const dated = new Map<string, string>();
  for (const match of decisions.matchAll(REMOVAL_DATE)) {
    dated.set((match[1] ?? '').replace(/^`+|[`,.;]+$/g, ''), match[2] ?? '');
  }
  return entries.flatMap((entry) => {
    const date = dated.get(entry);
    if (date === undefined) return [`${entry}: no DECISIONS entry with a removal date`];
    if (date < today) return [`${entry}: removal date ${date} has passed`];
    return [];
  });
}

describe('exclusionProblems', () => {
  const decisions =
    '- minimumReleaseAgeExclude: `left-pad@2.0.1` carries a security fix, remove on or after 2026-12-01.';

  it('flags an exclusion with no dated DECISIONS entry', () => {
    expect(exclusionProblems(['left-pad@2.0.1'], '', '2026-11-08')).toEqual([
      'left-pad@2.0.1: no DECISIONS entry with a removal date',
    ]);
  });

  it('flags an exclusion whose removal date has passed', () => {
    expect(exclusionProblems(['left-pad@2.0.1'], decisions, '2026-12-02')).toEqual([
      'left-pad@2.0.1: removal date 2026-12-01 has passed',
    ]);
  });

  it('accepts a dated exclusion before its date', () => {
    expect(exclusionProblems(['left-pad@2.0.1'], decisions, '2026-11-08')).toEqual([]);
  });
});

describe('pnpm-workspace.yaml minimumReleaseAgeExclude', () => {
  it('lists only packages that a DECISIONS entry names with a removal date still ahead', () => {
    // behavioral-test-allow: the artifacts under test ARE the pnpm settings file and the decision log; the exclusion policy has no runtime surface in this repository.
    const workspace = parse(readFileSync(join(process.cwd(), 'pnpm-workspace.yaml'), 'utf8')) as {
      minimumReleaseAgeExclude?: string[];
    };
    // behavioral-test-allow: same artifact reason as above.
    const decisions = readFileSync(join(process.cwd(), 'DECISIONS.md'), 'utf8');
    const today = new Date().toISOString().slice(0, 10);
    expect(exclusionProblems(workspace.minimumReleaseAgeExclude ?? [], decisions, today)).toEqual(
      [],
    );
  });
});
