import { describe, expect, it } from 'vitest';
import { askFacts } from '@/content/ask-facts';
import { credentials } from '@/content/credentials';
import { education } from '@/content/education';
import { gitLog } from '@/content/git-log';
import { perfReceipts } from '@/content/perf-receipts';
import {
  FUNDS_PHRASE,
  profile,
  profilePresentation,
  YEARS_OF_EXPERIENCE_LABEL,
} from '@/content/profile';
import { SITE_LOCALE } from '@/content/site-locale';
import { WORK_SCOPE_SENTENCE } from '@/content/work-scope';
import { buildJudgeFactSheet } from '@/lib/eval/fact-sheet';

const TODAY = new Date('2026-11-07T12:00:00Z');
const MAX_SHEET_LENGTH = 21000;

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

  it('states the verified job title, so a true title is never judged fabricated', () => {
    expect(buildJudgeFactSheet(TODAY)).toContain(`Current title: ${profile.title}`);
  });

  it('states the current employer scale and the years of experience', () => {
    const sheet = buildJudgeFactSheet(TODAY);
    expect(sheet).toContain(FUNDS_PHRASE);
    expect(sheet).toContain(profilePresentation[SITE_LOCALE.en].employerContext);
    expect(sheet).toContain(YEARS_OF_EXPERIENCE_LABEL);
  });

  it('lists every performance receipt with its company and delta', () => {
    const sheet = buildJudgeFactSheet(TODAY);
    for (const receipt of perfReceipts[SITE_LOCALE.en]) {
      expect(sheet, receipt.metric).toContain(receipt.metric);
      expect(sheet, receipt.metric).toContain(receipt.delta);
      expect(sheet, receipt.metric).toContain(receipt.company);
    }
  });

  it('separates where Erik lives from where each employer is located', () => {
    const sheet = buildJudgeFactSheet(TODAY);
    expect(sheet).toContain(`Erik lives in: ${profile.city}, ${profile.country}`);
    expect(sheet).toContain('employer location');
  });

  it('carries each role body so figures stated there are not read as invented', () => {
    const sheet = buildJudgeFactSheet(TODAY);
    for (const entry of gitLog[SITE_LOCALE.en]) {
      for (const line of entry.body) expect(sheet, entry.company).toContain(line);
    }
  });

  it('carries each role context and highlights so a figure stated there is never judged invented', () => {
    const sheet = buildJudgeFactSheet(TODAY);
    for (const entry of gitLog[SITE_LOCALE.en]) {
      if (entry.context) expect(sheet, entry.company).toContain(entry.context);
      for (const highlight of entry.highlights) expect(sheet, entry.company).toContain(highlight);
    }
  });

  it('states the work scope Erik is open to', () => {
    expect(buildJudgeFactSheet(TODAY)).toContain(WORK_SCOPE_SENTENCE);
  });

  it('states every fact the system prompt states, so a true fact is never judged fabricated', () => {
    const sheet = buildJudgeFactSheet(TODAY);
    expect(sheet).toContain(askFacts.openTo);
    for (const line of [
      ...askFacts.coreStack,
      ...askFacts.currentRoleScope,
      ...askFacts.targeting,
    ]) {
      expect(sheet, line).toContain(line);
    }
  });

  it('lists every credential with its badge and evidence', () => {
    const sheet = buildJudgeFactSheet(TODAY);
    for (const entry of credentials) {
      expect(sheet, entry.label).toContain(entry.label);
      expect(sheet, entry.label).toContain(entry.badge);
      expect(sheet, entry.label).toContain(entry.evidence);
    }
  });

  it('states the stack and AI skills the profile declares', () => {
    const sheet = buildJudgeFactSheet(TODAY);
    expect(sheet).toContain(profile.stackLine);
    expect(sheet).toContain(profile.aiLine);
  });

  it('lists every education entry', () => {
    const sheet = buildJudgeFactSheet(TODAY);
    for (const entry of education[SITE_LOCALE.en]) {
      expect(sheet, entry.id).toContain(entry.degree);
    }
  });

  it('is compact enough to ride along on every judge call', () => {
    expect(
      buildJudgeFactSheet(TODAY).length,
      'the judge sheet rides along uncached on every judge call at the judge model rate, and a run is capped at 2 USD: a sheet past this length projects a corpus plus calibration run over the cap. Add the fact to the criterion that needs it, not to the sheet.',
    ).toBeLessThan(MAX_SHEET_LENGTH);
  });
});
