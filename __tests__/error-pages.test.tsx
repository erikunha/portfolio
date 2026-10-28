import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NotFound, { metadata } from '@/app/not-found';
import { GlobalErrorPage, RouteErrorPage } from '@/components/ErrorBoundary/ErrorBoundary.client';
import { errorsContent } from '@/content/errors';
import { ErrorsContentSchema } from '@/content/schemas';

const SECRET_STACK = 'at secretInternalFrame (/srv/app/internal.ts:1:1)';

function makeError(digest?: string): Error & { digest?: string } {
  const error: Error & { digest?: string } = new Error('boom');
  error.stack = SECRET_STACK;
  if (digest) error.digest = digest;
  return error;
}

describe('errors content', () => {
  it('rejects a protocol-relative suggestion href', () => {
    const bad = structuredClone(errorsContent);
    bad.notFound.suggestions[0] = { label: 'x', href: '//evil.example' };
    expect(ErrorsContentSchema.safeParse(bad).success).toBe(false);
  });
});

describe('NotFound', () => {
  it('renders the 404 heading, the command line and every suggestion as a link', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('404');
    expect(screen.getByText(errorsContent.notFound.output)).not.toBeNull();
    for (const item of errorsContent.notFound.suggestions) {
      expect(screen.getByRole('link', { name: item.label }).getAttribute('href')).toBe(item.href);
    }
    expect(
      screen.getByRole('link', { name: errorsContent.notFound.home.label }).getAttribute('href'),
    ).toBe('/');
  });

  it('moves focus to the heading so the new page is announced', async () => {
    render(<NotFound />);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })),
    );
  });

  it('titles the document from content', () => {
    expect(metadata.title).toBe(errorsContent.notFound.metaTitle);
  });
});

describe('RouteErrorPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls reset when Try again is pressed', () => {
    const reset = vi.fn();
    render(<RouteErrorPage error={makeError()} reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: errorsContent.serverError.retryLabel }));
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
      screen.queryByRole('button', { name: errorsContent.serverError.copyAriaLabel }),
    ).toBeNull();
    unmount();

    render(<RouteErrorPage error={makeError('7F3A9C')} reset={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: errorsContent.serverError.copyAriaLabel }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('7F3A9C'));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        errorsContent.serverError.copiedAnnouncement,
      ),
    );
  });
});

describe('GlobalErrorPage', () => {
  it('renders its own html and body with a retry control and a way home', () => {
    const markup = renderToStaticMarkup(<GlobalErrorPage error={makeError()} reset={vi.fn()} />);
    expect(markup.startsWith('<html')).toBe(true);
    expect(markup).toContain('<body');
    expect(markup).toContain(errorsContent.serverError.retryLabel);
    expect(markup).toContain(`href="${errorsContent.serverError.home.href}"`);
    expect(markup).not.toContain('secretInternalFrame');
  });
});
