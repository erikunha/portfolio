import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LINKS_LOCALE } from '@/content/links.constants';
import { CHANNEL_URL } from '@/lib/links/feed';
import { ChannelNoscript } from './ChannelNoscript';

const SUBSCRIBE_QUERY = 'sub_confirmation=1';

function parse(locale: (typeof LINKS_LOCALE)[keyof typeof LINKS_LOCALE]) {
  return new DOMParser().parseFromString(
    renderToStaticMarkup(<ChannelNoscript locale={locale} />),
    'text/html',
  );
}

describe('ChannelNoscript', () => {
  it.each([
    [LINKS_LOCALE.en, 'subscribe'],
    [LINKS_LOCALE.pt, 'inscrever-se no canal'],
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
    const doc = parse(LINKS_LOCALE.en);

    expect(doc.querySelector('.links-watch-note')?.textContent).toBeTruthy();
    expect(doc.querySelector('[aria-busy="true"]')).toBeNull();
  });
});
