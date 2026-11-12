import { describe, expect, it } from 'vitest';
import { askErrors } from './ask-errors';
import { SITE_LOCALE } from './site-locale';

describe('ask refused error', () => {
  it('exists in both locales, differs from the interrupted line and names no provider', () => {
    for (const locale of [SITE_LOCALE.en, SITE_LOCALE.pt]) {
      const message = askErrors[locale].refused;
      expect(message.length, `${locale} refused copy must exist`).toBeGreaterThan(0);
      expect(message).not.toBe(askErrors[locale].interrupted);
      expect(message, `${locale} refused copy must not name a provider`).not.toMatch(
        /anthropic|claude|gateway|haiku|filter|filtro/i,
      );
    }
  });
});
