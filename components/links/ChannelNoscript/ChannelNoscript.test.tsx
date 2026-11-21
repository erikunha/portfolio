import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SITE_LOCALE } from '@/content/site-locale';
import { CHANNEL_URL } from '@/lib/links/feed';
import { ChannelNoscript } from './ChannelNoscript';

const SUBSCRIBE_QUERY = 'sub_confirmation=1';

function parse(locale: (typeof SITE_LOCALE)[keyof typeof SITE_LOCALE]) {
  return new DOMParser().parseFromString(
    renderToStaticMarkup(<ChannelNoscript locale={locale} />),
    'text/html',
  );
}

describe('ChannelNoscript', () => {
  it.each([
    [SITE_LOCALE.en, 'subscribe'],
    [SITE_LOCALE.pt, 'inscrever-se no canal'],
  ])(
    'keeps a subscribe link to the channel for a visitor without scripts (%s)',
    (locale, label) => {
      const doc = parse(locale);
      const link = doc.querySelector<HTMLAnchorElement>('a[data-outbound="inscrever"]');

      expect(link?.getAttribute('href')).toContain(`${CHANNEL_URL}?${SUBSCRIBE_QUERY}`);
      expect(link?.textContent).toContain(label);
      expect(link?.getAttribute('target')).toBe('_blank');
    },
  );

  it('says the feed is not shown instead of leaving a loading state', () => {
    const doc = parse(SITE_LOCALE.en);

    expect(doc.querySelector('.links-watch-note')?.textContent).toBeTruthy();
    expect(doc.querySelector('[aria-busy="true"]')).toBeNull();
  });
});
