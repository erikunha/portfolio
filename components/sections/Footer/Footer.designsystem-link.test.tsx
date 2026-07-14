import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BreakpointProvider } from '@/lib/use-breakpoint.client';
import { Footer } from './Footer.client';

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly scrollMargin = '';
  readonly thresholds = [];
  // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
  observe() {}
  // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
  unobserve() {}
  // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
      addEventListener: () => {},
      // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
      removeEventListener: () => {},
    })),
  );
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  stubMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Footer design-system link', () => {
  it.each([
    ['desktop', false],
    ['mobile', true],
  ])('links to /design-system as a same-site internal link (no target=_blank) on %s', (_variant, initialIsMobile) => {
    stubMatchMedia(initialIsMobile);
    const { container } = render(
      <BreakpointProvider initialIsMobile={initialIsMobile}>
        <Footer />
      </BreakpointProvider>,
    );
    const pre = container.querySelector('pre');
    expect(pre !== null).toBe(!initialIsMobile);
    const links = [...container.querySelectorAll('a[href="/design-system"]')];
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      expect(a.getAttribute('target')).not.toBe('_blank');
    }
  });

  it.each([
    ['desktop', false],
    ['mobile', true],
  ])('self-links to the site use the canonical www host, never the apex that 308-redirects on %s', (_variant, initialIsMobile) => {
    stubMatchMedia(initialIsMobile);
    const { container } = render(
      <BreakpointProvider initialIsMobile={initialIsMobile}>
        <Footer />
      </BreakpointProvider>,
    );
    expect(container.querySelector('a[href="https://erikunha.dev"]')).toBeNull();
    expect(container.querySelector('a[href="https://www.erikunha.dev"]')).not.toBeNull();
  });
});
