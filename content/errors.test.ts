import { describe, expect, it } from 'vitest';
import { errorsContent } from './errors';
import { SITE_LOCALE } from './site-locale';

describe('404 copy', () => {
  it('titles the Portuguese 404 with the bare host, like the English one', () => {
    expect(errorsContent[SITE_LOCALE.pt].notFound.metaTitle).toBe('404 · erikunha.dev');
    expect(errorsContent[SITE_LOCALE.en].notFound.metaTitle).toBe('404 · erikunha.dev');
  });

  it('labels the Portuguese suggestions TENTE ISTO', () => {
    expect(errorsContent[SITE_LOCALE.pt].notFound.suggestionsLabel).toBe('TENTE ISTO');
  });
});
