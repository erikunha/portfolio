import { describe, expect, it } from 'vitest';
import { credentials } from '@/content/credentials';
import { education } from '@/content/education';
import { SITE_LOCALE } from '@/content/site-locale';
import { formatCredentialLine, formatEducationLine } from '@/lib/ask/education-format';
import { buildJudgeFactSheet } from '@/lib/eval/fact-sheet';

const RUN_DATE = new Date('2026-11-21T00:00:00Z');

describe('judge fact sheet education and credentials', () => {
  const sheet = buildJudgeFactSheet(RUN_DATE);

  it('states every education line the system prompt states, coursework included', () => {
    for (const entry of education[SITE_LOCALE.en]) {
      expect(sheet, `missing education line for ${entry.id}`).toContain(formatEducationLine(entry));
    }
  });

  it('states every credential line the system prompt states', () => {
    for (const entry of credentials) {
      expect(sheet, `missing credential line for ${entry.label}`).toContain(
        formatCredentialLine(entry),
      );
    }
  });
});
