import { describe, expect, it } from 'vitest';
import { askErrors } from './ask-errors';
import { SITE_LOCALE } from './site-locale';
import { social } from './social';

describe('ask budget error', () => {
  it('says answers are paused without naming an internal budget', () => {
    expect(askErrors[SITE_LOCALE.en].budget).toBe(
      `AI answers are paused for this month. Email ${social.email} instead.`,
    );
    expect(askErrors[SITE_LOCALE.pt].budget).toBe(
      `As respostas de IA estão pausadas neste mês. Escreva para ${social.email}.`,
    );
  });
});

describe('ask interrupted error', () => {
  it('offers a retry and the email in both locales without naming a provider', () => {
    for (const locale of [SITE_LOCALE.en, SITE_LOCALE.pt]) {
      const message = askErrors[locale].interrupted;
      expect(message, `${locale} interrupted error must point to the email`).toContain(
        social.email,
      );
      expect(message, `${locale} interrupted error must not name a provider`).not.toMatch(
        /anthropic|claude|gateway|haiku/i,
      );
    }
  });
});
