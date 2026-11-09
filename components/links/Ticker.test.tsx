import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { linksContent } from '@/content/links';
import { LINKS_LOCALE } from '@/content/links.constants';
import { Ticker } from './Ticker';

describe('Ticker', () => {
  it('states the next-video teaser in the viewer language', () => {
    const { upcoming } = linksContent;
    for (const locale of [LINKS_LOCALE.pt, LINKS_LOCALE.en]) {
      const { container } = render(<Ticker locale={locale} />);
      expect(container.textContent).toContain(upcoming.label[locale]);
      expect(container.textContent).toContain(upcoming.topic[locale]);
    }
  });

  it('keeps the loop copy out of the accessibility tree', () => {
    const { container } = render(<Ticker locale={LINKS_LOCALE.en} />);
    const copies = container.querySelectorAll('.links-ticker-track > span');
    expect(copies).toHaveLength(2);
    expect(copies[1]?.getAttribute('aria-hidden')).toBe('true');
  });
});
