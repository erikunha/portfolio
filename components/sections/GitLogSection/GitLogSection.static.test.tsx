import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SITE_LOCALE } from '@/content/site-locale';
import { GitLogContent } from './GitLogSection';

describe('GitLogContent: the career log does not scroll', () => {
  it.each(Object.values(SITE_LOCALE))(
    'is neither a tab stop nor a labelled group (%s)',
    (locale) => {
      const host = document.createElement('div');
      host.innerHTML = renderToStaticMarkup(<GitLogContent locale={locale} />);
      const log = host.querySelector('[data-testid="career-log"]');
      expect(log, 'the log container renders').not.toBeNull();
      expect(log?.hasAttribute('tabindex'), 'a non-scrolling block must not take focus').toBe(
        false,
      );
      expect(log?.hasAttribute('role')).toBe(false);
      expect(log?.hasAttribute('aria-label')).toBe(false);
    },
  );
});
