import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { shellLoadingLabel, shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { shellChrome } from '@/content/terminal-chrome';
import { InteractiveShellLazy } from './InteractiveShellLazy';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

function markup(locale: (typeof SITE_LOCALE)[keyof typeof SITE_LOCALE]) {
  return renderToStaticMarkup(
    <InteractiveShellLazy
      locale={locale}
      ui={shellUi[locale]}
      chrome={shellChrome[locale]}
      loadingLabel={shellLoadingLabel[locale]}
    />,
  );
}

describe('the interactive shell for a visitor without scripts', () => {
  it.each(Object.values(SITE_LOCALE))(
    'explains in %s that the shell needs JavaScript and links the email',
    (locale) => {
      const ui = shellUi[locale];
      const html = markup(locale);
      const noscript = html.slice(html.indexOf('<noscript>'), html.indexOf('</noscript>'));
      expect(noscript).toContain('data-testid="shell-nojs"');
      expect(noscript).toContain(ui.noscript);
      expect(noscript).toContain(`href="${ui.emailHref}"`);
      expect(noscript.replace(/<\/?(?:wbr\/|span)>/g, '')).toContain(`>${ui.email}</a>`);
    },
  );
});
