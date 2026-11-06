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
