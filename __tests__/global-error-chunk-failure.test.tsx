import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalErrorPage } from '@/components/ErrorPages/GlobalErrorPage.client';
import { serverErrorContent } from '@/content/server-error-detail';
import { SITE_LOCALE } from '@/content/site-locale';

vi.mock('@/components/ErrorPages/GlobalErrorBody.client', () => {
  throw new Error('ChunkLoadError');
});

describe('GlobalErrorPage when its body chunk cannot load', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps a readable page with a working retry and a way home', async () => {
    const reset = vi.fn();
    const copy = serverErrorContent[SITE_LOCALE.en];
    render(<GlobalErrorPage error={new Error('boom')} reset={reset} />, { container: document });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(
      screen.getByText(copy.message),
      'a failed body chunk must leave the last-resort page readable',
    ).not.toBeNull();
    expect(screen.queryByText(copy.bootRender, { exact: false })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: copy.retryLabel }));
    expect(reset, 'retry must reach the router reset without the body chunk').toHaveBeenCalledTimes(
      1,
    );
    expect(screen.getByRole('link', { name: copy.home.label }).getAttribute('href')).toBe(
      copy.home.href,
    );
  });
});
