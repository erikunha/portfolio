import { act, createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMatchMedia } from '@/__tests__/helpers/match-media';
import { flushMicrotasks, mountClient } from '@/__tests__/helpers/render';
import { MOBILE_QUERY } from '@/lib/media-queries';
import { useBreakpoint } from '@/lib/use-breakpoint.client';

let captured: { isMobile: boolean } | undefined;

function Consumer() {
  captured = useBreakpoint();
  return createElement('span', null, String(captured.isMobile));
}

describe('useBreakpoint', () => {
  beforeEach(() => {
    captured = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('works without any provider above it', async () => {
    installMatchMedia(false);
    const { unmount } = await mountClient(createElement(Consumer));
    await flushMicrotasks();

    expect(captured?.isMobile).toBe(false);
    unmount();
  });

  it('reports a mobile viewport from matchMedia', async () => {
    installMatchMedia(true);
    const { unmount } = await mountClient(createElement(Consumer));
    await flushMicrotasks();

    expect(captured?.isMobile).toBe(true);
    unmount();
  });

  it('seeds the server render with a desktop viewport', () => {
    expect(renderToString(createElement(Consumer))).toContain('false');
  });

  it('subscribes with the one mobile query and unsubscribes on unmount', async () => {
    const media = installMatchMedia(false);
    const { unmount } = await mountClient(createElement(Consumer));
    expect(media.matchMedia).toHaveBeenCalledWith(MOBILE_QUERY);
    expect(media.listenerCount(MOBILE_QUERY)).toBe(1);
    unmount();
    expect(media.listenerCount(MOBILE_QUERY)).toBe(0);
  });

  it('re-renders when the viewport crosses the mobile breakpoint', async () => {
    const media = installMatchMedia(false);
    const { container, unmount } = await mountClient(createElement(Consumer));
    expect(container.textContent).toBe('false');

    await act(async () => {
      media.emit(MOBILE_QUERY, true);
    });
    expect(container.textContent).toBe('true');

    await act(async () => {
      media.emit(MOBILE_QUERY, false);
    });
    expect(container.textContent).toBe('false');
    unmount();
  });
});

describe('MOBILE_QUERY', () => {
  it('ends 0.02px below the mobile breakpoint, matching the CSS max-width queries', () => {
    expect(MOBILE_QUERY).toBe('(max-width: 767.98px)');
  });
});
