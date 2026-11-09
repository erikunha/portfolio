import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import EnMissingRoute from '@/app/(en)/[...missing]/page';
import PtMissingRoute from '@/app/(pt)/pt/[...missing]/page';
import { errorsContent } from '@/content/errors';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';

const PAGES: Record<SiteLocale, () => React.ReactElement> = {
  [SITE_LOCALE.en]: EnMissingRoute,
  [SITE_LOCALE.pt]: PtMissingRoute,
};

describe('unknown route', () => {
  for (const locale of Object.values(SITE_LOCALE)) {
    it(`the ${locale} catch-all sends the 404 page in the server HTML, not an empty shell`, () => {
      const Page = PAGES[locale];
      const html = renderToString(<Page />);
      const { notFound } = errorsContent[locale];
      expect(
        html,
        'notFound() thrown outside a Suspense boundary makes Next prerender an empty html shell, so a visitor without scripts, a link preview and a screen reader before hydration get a blank page',
      ).toContain(`>${notFound.code}</h1>`);
      expect(html).toContain(notFound.home.label);
      for (const item of notFound.suggestions) {
        expect(html).toContain(`href="${item.href}"`);
      }
    });
  }
});
