import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalErrorPage } from '@/components/ErrorPages/GlobalErrorPage.client';
import { RouteErrorPage } from '@/components/ErrorPages/RouteErrorPage.client';
import { serverErrorContent } from '@/content/server-error-detail';
import { SITE_LOCALE } from '@/content/site-locale';

const retryLabel = serverErrorContent[SITE_LOCALE.en].retryLabel;

function props() {
  return { error: new Error('boom'), retry: vi.fn(), reset: vi.fn() };
}

describe('error pages recover through retry', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('global error page calls retry and never reset, before and after its body loads', async () => {
    const handlers = props();
    render(<GlobalErrorPage {...handlers} />, { container: document });
    const fallbackRetry = screen.getByRole('button', { name: retryLabel });
    fireEvent.click(fallbackRetry);
    expect(handlers.retry, 'the static fallback').toHaveBeenCalledTimes(1);
    await waitFor(() => expect(fallbackRetry.isConnected).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: retryLabel }));
    expect(handlers.retry, 'the loaded body').toHaveBeenCalledTimes(2);
    expect(handlers.reset).not.toHaveBeenCalled();
  });

  it('route error page calls retry and never reset', () => {
    const handlers = props();
    render(<RouteErrorPage {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: retryLabel }));
    expect(handlers.retry).toHaveBeenCalledTimes(1);
    expect(handlers.reset).not.toHaveBeenCalled();
  });
});
