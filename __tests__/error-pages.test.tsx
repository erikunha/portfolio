import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NotFound, { metadata } from '@/app/(en)/[...missing]/not-found';
import { ellipsizeRef } from '@/components/ErrorPages/ErrorPages.client';
import { GlobalErrorPage } from '@/components/ErrorPages/GlobalErrorPage.client';
import { RouteErrorPage } from '@/components/ErrorPages/RouteErrorPage.client';
import { errorsContent } from '@/content/errors';
import { ErrorsContentSchema } from '@/content/schemas';
import { SITE_LOCALE } from '@/content/site-locale';

const SECRET_STACK = 'at secretInternalFrame (/srv/app/internal.ts:1:1)';

function makeError(digest?: string): Error & { digest?: string } {
  const error: Error & { digest?: string } = new Error('boom');
  error.stack = SECRET_STACK;
  if (digest) error.digest = digest;
  return error;
}

describe('errors content', () => {
  it('rejects a protocol-relative suggestion href', () => {
    const bad = structuredClone(errorsContent[SITE_LOCALE.en]);
    bad.notFound.suggestions[0] = { label: 'x', href: '//evil.example' };
    expect(ErrorsContentSchema.safeParse(bad).success).toBe(false);
  });
});

describe('NotFound', () => {
  it('renders inside the shared shell: one banner with the menu, MOTION and the brand icon', () => {
    const { container } = render(<NotFound />);
    const banner = container.querySelector('header.desktop-topbar');

    expect(banner, 'the home topbar').not.toBeNull();
    expect(container.querySelector('header.err-bar')).toBeNull();
    expect(container.querySelector('header.mobile-title-bar')).not.toBeNull();
    expect(banner?.querySelector('.menu-trigger')).not.toBeNull();
    expect(banner?.querySelector('a[href="/"]')).not.toBeNull();
    expect(container.querySelectorAll('main#main-content')).toHaveLength(1);
    expect(container.querySelectorAll('a.skip-to-content')).toHaveLength(1);
  });

  it('renders the 404 heading, the command line and every suggestion as a link', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('404');
    expect(screen.getByText(errorsContent[SITE_LOCALE.en].notFound.output)).not.toBeNull();
    for (const item of errorsContent[SITE_LOCALE.en].notFound.suggestions) {
      expect(
        within(screen.getByRole('main'))
          .getByRole('link', { name: item.label })
          .getAttribute('href'),
      ).toBe(item.href);
    }
    expect(
      within(screen.getByRole('main'))
        .getByRole('link', { name: errorsContent[SITE_LOCALE.en].notFound.home.label })
        .getAttribute('href'),
    ).toBe('/');
  });

  it('moves focus to the heading so the new page is announced', async () => {
    render(<NotFound />);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })),
    );
  });

  it('titles the document from content', () => {
    expect(metadata.title).toBe(errorsContent[SITE_LOCALE.en].notFound.metaTitle);
  });
});

describe('RouteErrorPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders inside the shared shell', () => {
    const { container } = render(<RouteErrorPage error={makeError()} reset={vi.fn()} />);

    expect(container.querySelector('header.desktop-topbar .menu-trigger')).not.toBeNull();
    expect(container.querySelector('header.mobile-title-bar')).not.toBeNull();
    expect(container.querySelectorAll('main#main-content')).toHaveLength(1);
  });

  it('calls reset when Try again is pressed', () => {
    const reset = vi.fn();
    render(<RouteErrorPage error={makeError()} reset={reset} />);
    fireEvent.click(
      screen.getByRole('button', { name: errorsContent[SITE_LOCALE.en].serverError.retryLabel }),
    );
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('reports through the log endpoint and never renders the stack', () => {
    const { container } = render(<RouteErrorPage error={makeError()} reset={vi.fn()} />);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(url).toBe('/api/log');
    expect(JSON.parse(String((init as RequestInit).body)).message).toContain('boom');
    expect(container.textContent).not.toContain('secretInternalFrame');
    expect(container.textContent).not.toContain('boom');
  });

  it('shows the digest reference only when one exists and copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const { unmount } = render(<RouteErrorPage error={makeError()} reset={vi.fn()} />);
    expect(
      screen.queryByRole('button', {
        name: errorsContent[SITE_LOCALE.en].serverError.copyAriaLabel,
      }),
    ).toBeNull();
    unmount();

    render(<RouteErrorPage error={makeError('7F3A9C')} reset={vi.fn()} />);
    fireEvent.click(
      screen.getByRole('button', { name: errorsContent[SITE_LOCALE.en].serverError.copyAriaLabel }),
    );
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('7F3A9C'));
    await waitFor(() =>
      expect(within(screen.getByRole('main')).getByRole('status').textContent).toBe(
        errorsContent[SITE_LOCALE.en].serverError.copiedAnnouncement,
      ),
    );
  });
});

const LONG_DIGEST = '4d2c91aa7b30e8aa';
const ELAPSED_MS = 12004.6;

describe('RouteErrorPage panic layout', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('stamps the boot lines with the real elapsed seconds, rounded to milliseconds', () => {
    vi.spyOn(performance, 'now').mockReturnValue(ELAPSED_MS);
    render(<RouteErrorPage error={makeError()} reset={vi.fn()} />);
    const copy = errorsContent[SITE_LOCALE.en].serverError;
    expect(screen.getByText(`[ 12.005 ] ${copy.bootRender}`)).not.toBeNull();
    expect(screen.getByText(`[ 12.005 ] ${copy.bootReport}`)).not.toBeNull();
  });

  it('keeps the announced alert to the message, not the log lines', () => {
    render(<RouteErrorPage error={makeError()} reset={vi.fn()} />);
    const copy = errorsContent[SITE_LOCALE.en].serverError;
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(copy.message);
    expect(
      screen.getByText(copy.bootRender, { exact: false }).closest('[aria-hidden]'),
    ).not.toBeNull();
  });

  it('ellipsizes a long reference, keeps the full id in the title and copies the full id', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<RouteErrorPage error={makeError(LONG_DIGEST)} reset={vi.fn()} />);
    const code = screen.getByText('4d2c...e8aa');
    expect(code.getAttribute('title')).toBe(LONG_DIGEST);
    fireEvent.click(
      screen.getByRole('button', { name: errorsContent[SITE_LOCALE.en].serverError.copyAriaLabel }),
    );
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(LONG_DIGEST));
  });

  it('shows a short reference whole', () => {
    render(<RouteErrorPage error={makeError('7F3A9C')} reset={vi.fn()} />);
    expect(screen.getByText('7F3A9C').getAttribute('title')).toBe('7F3A9C');
  });
});

describe('ellipsizeRef', () => {
  it.each([
    ['abcd1234567', 'abcd1234567'],
    ['abcd12345678', 'abcd...5678'],
  ])('turns %s into %s', (id, short) => {
    expect(ellipsizeRef(id)).toBe(short);
  });
});

describe('GlobalErrorPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('carries the same reference block as the route error page once its body loads', async () => {
    render(<GlobalErrorPage error={makeError(LONG_DIGEST)} reset={vi.fn()} />, {
      container: document,
    });
    const copy = errorsContent[SITE_LOCALE.en].serverError;
    const code = await screen.findByText('4d2c...e8aa');
    expect(code.getAttribute('title')).toBe(LONG_DIGEST);
    expect(screen.getByRole('button', { name: copy.copyAriaLabel })).not.toBeNull();
  });

  it('omits the reference block when there is no digest', async () => {
    render(<GlobalErrorPage error={makeError()} reset={vi.fn()} />, { container: document });
    const copy = errorsContent[SITE_LOCALE.en].serverError;
    await screen.findByText(copy.bootRender, { exact: false });
    expect(screen.queryByRole('button', { name: copy.copyAriaLabel })).toBeNull();
  });

  it('renders its own html and body with a retry control and a way home before the body loads', () => {
    const markup = renderToStaticMarkup(<GlobalErrorPage error={makeError()} reset={vi.fn()} />);
    expect(markup.startsWith('<html')).toBe(true);
    expect(markup).toContain('<body');
    expect(markup).toContain(errorsContent[SITE_LOCALE.en].serverError.retryLabel);
    expect(markup).toContain(`href="${errorsContent[SITE_LOCALE.en].serverError.home.href}"`);
    expect(markup).not.toContain('secretInternalFrame');
  });
});

describe.each([
  ['app/(en)/error.tsx', () => import('@/app/(en)/error')],
  ['app/(pt)/error.tsx', () => import('@/app/(pt)/error')],
])('%s', (_name, load) => {
  it('loads the 500 page on demand and still renders it for a route error', async () => {
    const { default: RouteError } = await load();
    render(<RouteError error={makeError()} reset={() => undefined} />);
    expect(
      await screen.findByText(errorsContent[SITE_LOCALE.en].serverError.message),
      'the lazy route error page must resolve to the full 500 page',
    ).toBeTruthy();
  });
});
