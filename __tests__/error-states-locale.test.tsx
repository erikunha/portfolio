import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorsContent } from '@/content/errors';
import { localeOfPath, SITE_LOCALE } from '@/content/site-locale';

let pathname = '/pt/cv';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

function Crash(): never {
  throw new Error('island crash');
}

describe('localeOfPath', () => {
  it.each([
    ['/pt', SITE_LOCALE.pt],
    ['/pt/cv', SITE_LOCALE.pt],
    ['/', SITE_LOCALE.en],
    ['/cv', SITE_LOCALE.en],
    ['/ptx', SITE_LOCALE.en],
    [null, SITE_LOCALE.en],
  ])('reads %s as %s', (path, locale) => {
    expect(localeOfPath(path)).toBe(locale);
  });
});

describe('error states follow the page language', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    pathname = '/pt/cv';
  });

  it('shows the route error page in Portuguese under /pt', async () => {
    const { RouteErrorPage } = await import('@/components/ErrorPages/ErrorPages.client');
    render(<RouteErrorPage error={new Error('boom')} reset={vi.fn()} />);
    const pt = errorsContent[SITE_LOCALE.pt].serverError;
    expect(screen.getByText(pt.message)).not.toBeNull();
    expect(screen.getByRole('button', { name: pt.retryLabel })).not.toBeNull();
    expect(screen.getByText(pt.bootRender, { exact: false })).not.toBeNull();
    expect(screen.getByText(pt.bootReport, { exact: false })).not.toBeNull();
  });

  it('shows the global error page in Portuguese under /pt', async () => {
    const { GlobalErrorPage } = await import('@/components/ErrorPages/GlobalErrorPage.client');
    const markup = renderToStaticMarkup(
      <GlobalErrorPage error={new Error('boom')} reset={vi.fn()} />,
    );
    expect(markup).toContain(errorsContent[SITE_LOCALE.pt].serverError.retryLabel);
    expect(markup).toContain('lang="pt-BR"');
  });

  it('labels a crashed island in the page language', async () => {
    const { ErrorBoundary } = await import('@/components/ErrorBoundary');
    for (const locale of Object.values(SITE_LOCALE)) {
      const { unmount } = render(
        <ErrorBoundary locale={locale}>
          <Crash />
        </ErrorBoundary>,
      );
      expect(screen.getByRole('alert').textContent).toContain(
        errorsContent[locale].componentUnavailable,
      );
      unmount();
    }
  });
});
