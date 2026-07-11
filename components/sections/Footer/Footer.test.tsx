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
  // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
  unobserve() {}
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

describe('FooterLazy — IntersectionObserver-gated mount', () => {
  it('imports and exposes a FooterLazy named export', async () => {
    const mod = await import('@/components/sections/Footer');
    expect(typeof mod.FooterLazy).toBe('function');
  });

  it('IntersectionObserver is captured by the mount effect when component renders', async () => {
    const { FooterLazy } = await import('@/components/sections/Footer');

    const { container, unmount } = await mountClient(createElement(FooterLazy));

    const sentinel = container.querySelector('[data-testid="footer-lazy-sentinel"]');
    expect(sentinel).not.toBeNull();
    expect(sentinel?.getAttribute('aria-hidden')).toBe('true');

    expect(observedNodes).toHaveLength(1);
    expect(observedNodes[0]).toBe(sentinel);

    unmount();
  });

  it('disconnects the IntersectionObserver when the sentinel intersects', async () => {
    const { FooterLazy } = await import('@/components/sections/Footer');

    const { unmount } = await mountClient(createElement(FooterLazy));

    const cb = lastCallback;
    expect(cb).toBeDefined();
    if (cb) {
      const entry = { isIntersecting: true } as unknown as IntersectionObserverEntry;
      cb([entry], new MockIO(cb));
    }

    expect(disconnected).toBe(true);

    unmount();
  });
});
