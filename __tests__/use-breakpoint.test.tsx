import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, mountClient } from '@/__tests__/helpers/render';
import { MOBILE_QUERY } from '@/lib/media-queries';
import { useBreakpoint } from '@/lib/use-breakpoint.client';

type MediaListener = () => void;

function stubMatchMedia(matches: boolean) {
  const listeners: MediaListener[] = [];
  const mql = {
    matches,
    addEventListener: (_: string, cb: MediaListener) => listeners.push(cb),
    removeEventListener: (_: string, cb: MediaListener) => {
      const idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    },
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mql),
  );
  return { mql, listeners };
}

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
    stubMatchMedia(false);
    const { unmount } = await mountClient(createElement(Consumer));
    await flushMicrotasks();

    expect(captured?.isMobile).toBe(false);
    unmount();
  });

  it('reports a mobile viewport from matchMedia', async () => {
    stubMatchMedia(true);
    const { unmount } = await mountClient(createElement(Consumer));
    await flushMicrotasks();

    expect(captured?.isMobile).toBe(true);
    unmount();
  });

  it('seeds the server render with a desktop viewport', () => {
    expect(renderToString(createElement(Consumer))).toContain('false');
  });

  it('subscribes with the one mobile query and unsubscribes on unmount', async () => {
    const { listeners } = stubMatchMedia(false);
    const { unmount } = await mountClient(createElement(Consumer));
    expect(vi.mocked(window.matchMedia)).toHaveBeenCalledWith(MOBILE_QUERY);
    expect(listeners).toHaveLength(1);
    unmount();
    expect(listeners).toHaveLength(0);
  });
});

describe('MOBILE_QUERY', () => {
  it('ends 0.02px below the mobile breakpoint, matching the CSS max-width queries', () => {
    expect(MOBILE_QUERY).toBe('(max-width: 767.98px)');
  });
});
