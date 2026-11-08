import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { footerContent } from '@/content/footer';
import { SITE_LOCALE } from '@/content/site-locale';
import { Footer } from './index';

describe.each(Object.values(SITE_LOCALE))(
  'Footer reboot control for a pointer without a keyboard (%s)',
  (locale) => {
    function rebootLink() {
      const link = render(<Footer locale={locale} />).container.querySelector('.footer-reboot');
      if (!link) throw new Error('the footer renders its reboot control');
      return link;
    }

    it('carries the tap wording from content, shown instead of the key hint on a coarse pointer', () => {
      expect(rebootLink().getAttribute('data-touch-label')).toBe(
        footerContent[locale].reboot.touch,
      );
    });

    it('keeps the key hint in its own wrapper so a coarse pointer can hide it', () => {
      const keys = rebootLink().querySelector('.footer-reboot-keys');
      expect(keys?.querySelector('kbd')?.textContent).toBe(footerContent[locale].reboot.key);
    });

    it('keeps the tap wording inside the accessible name (WCAG 2.5.3 label in name)', () => {
      const link = rebootLink();
      const name = (link.getAttribute('aria-label') ?? '').toLowerCase();
      expect(link.getAttribute('data-touch-label')?.length).toBeGreaterThan(0);
      expect(
        name,
        'the tap wording is the visible label on touch, so the name must contain it',
      ).toContain((link.getAttribute('data-touch-label') ?? '').toLowerCase());
    });
  },
);
