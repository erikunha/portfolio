// components/sections/Footer/Footer.test.tsx
// Behavioral test for the FooterLazy IntersectionObserver-gated mount.
// PR 6 of audit roadmap (Theme 4).
//
// The contract: FooterLazy renders an aria-hidden sentinel initially; only
// after the sentinel scrolls into view (or the rootMargin buffer hits) does
// it dynamic-import + mount Footer. This test exercises the sentinel-first
// shape and the IO subscription behavior without triggering the full Footer
// hydration (which has heavy dependencies — MatrixRain canvas, dmesg
// content, breakpoint hook, setInterval — that are exercised elsewhere).

import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountClient } from '@/__tests__/helpers/render';

let observedNodes: Element[] = [];
let lastCallback: IntersectionObserverCallback | undefined;
let disconnected = false;

class MockIO implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly scrollMargin = '';
  readonly thresholds = [];

  constructor(cb: IntersectionObserverCallback) {
    lastCallback = cb;
  }
  observe(target: Element) {
    observedNodes.push(target);
  }
  unobserve() {
    /* not exercised by these tests */
  }
  disconnect() {
    disconnected = true;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

beforeEach(() => {
  observedNodes = [];
  lastCallback = undefined;
  disconnected = false;
  vi.stubGlobal('IntersectionObserver', MockIO);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FooterLazy — IntersectionObserver-gated mount (audit Theme 4)', () => {
  it('imports and exposes a FooterLazy named export', async () => {
    const mod = await import('@/components/sections/Footer');
    expect(typeof mod.FooterLazy).toBe('function');
  });

  it('IntersectionObserver is captured by the mount effect when component renders', async () => {
    // We exercise the IO contract directly by rendering FooterLazy into a
    // jsdom container. mountClient renders under act() so the mount effect
    // commits before the call resolves.
    const { FooterLazy } = await import('@/components/sections/Footer');

    const { container, unmount } = await mountClient(createElement(FooterLazy));

    // After mount, the sentinel element should be in the DOM with the
    // expected data-testid and ARIA hidden flag.
    const sentinel = container.querySelector('[data-testid="footer-lazy-sentinel"]');
    expect(sentinel).not.toBeNull();
    expect(sentinel?.getAttribute('aria-hidden')).toBe('true');

    // And the IntersectionObserver must have observed exactly the sentinel.
    expect(observedNodes).toHaveLength(1);
    expect(observedNodes[0]).toBe(sentinel);

    unmount();
  });

  it('disconnects the IntersectionObserver when the sentinel intersects', async () => {
    const { FooterLazy } = await import('@/components/sections/Footer');

    const { unmount } = await mountClient(createElement(FooterLazy));

    // Fire the IO callback with isIntersecting: true. The component should
    // disconnect the observer in response (no more callbacks needed).
    const cb = lastCallback;
    expect(cb).toBeDefined();
    if (cb) {
      // Cast through unknown since the mock entry doesn't carry the full
      // IntersectionObserverEntry interface — only what the component reads.
      const entry = { isIntersecting: true } as unknown as IntersectionObserverEntry;
      cb([entry], new MockIO(cb));
    }

    // The component's effect disconnects the observer after intersection.
    expect(disconnected).toBe(true);

    unmount();
  });
});
