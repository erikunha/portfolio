import { describe, expect, it } from 'vitest';
import * as linksConstants from '@/content/links.constants';
import { LINKS_INTL_LOCALE, LINKS_LOCALE } from '@/content/links.constants';
import { SITE_HTML_LANG, SITE_LOCALE } from '@/content/site-locale';

describe('links locale model', () => {
  it('is the site locale model itself, so there is one set of locale tables', () => {
    expect(LINKS_LOCALE).toBe(SITE_LOCALE);
    expect(LINKS_INTL_LOCALE).toBe(SITE_HTML_LANG);
  });

  it('carries no second Open Graph locale table', () => {
    expect(Object.keys(linksConstants)).not.toContain('LINKS_OG_LOCALE');
  });
});
