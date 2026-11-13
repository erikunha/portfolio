import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalErrorPage } from '@/components/ErrorPages/GlobalErrorPage.client';
import { serverErrorContent } from '@/content/server-error-detail';
import { SITE_LOCALE } from '@/content/site-locale';

vi.mock('@/components/ErrorPages/GlobalErrorBody.client', () => {
  throw new Error('ChunkLoadError');
});

const NOT_TABBABLE = '-1';

describe('the last-resort error page after a root crash', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('moves focus to its heading while the body chunk loads and after it fails', async () => {
    const copy = serverErrorContent[SITE_LOCALE.en];
    render(<GlobalErrorPage error={new Error('boom')} reset={vi.fn()} />, {
      container: document,
    });
    const heading = screen.getByRole('heading', { level: 1, name: copy.code });

    expect(
      document.activeElement,
      'a screen reader user must land on the error heading, as on the 404 and route error pages',
    ).toBe(heading);
    expect(heading.getAttribute('tabindex')).toBe(NOT_TABBABLE);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: copy.code }));
  });
});
