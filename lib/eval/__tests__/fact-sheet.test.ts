import { describe, expect, it } from 'vitest';
import { gitLog } from '@/content/git-log';
import { SITE_LOCALE } from '@/content/site-locale';
import { buildJudgeFactSheet } from '@/lib/eval/fact-sheet';

const TODAY = new Date('2026-11-07T12:00:00Z');

describe('lib/eval/fact-sheet', () => {
  it('states the run date so a recent start date is not read as a future date', () => {
    expect(buildJudgeFactSheet(TODAY)).toContain('2026-11-07');
  });

  it('lists every employer with its role and dates from the career content', () => {
    const sheet = buildJudgeFactSheet(TODAY);
    for (const entry of gitLog[SITE_LOCALE.en]) {
      expect(sheet, entry.company).toContain(entry.company);
      expect(sheet, entry.company).toContain(entry.role);
      expect(sheet, entry.company).toContain(entry.date);
    }
  });

  it('marks the current role as the one with no end date', () => {
    const [current] = gitLog[SITE_LOCALE.en];
    const currentLine = buildJudgeFactSheet(TODAY)
      .split('\n')
      .find((line) => current && line.includes(current.company));
    expect(currentLine).toMatch(/current/i);
  });

  it('is compact enough to ride along on every judge call', () => {
    expect(buildJudgeFactSheet(TODAY).length).toBeLessThan(2500);
  });
});
