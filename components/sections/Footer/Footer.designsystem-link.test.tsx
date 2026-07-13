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

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
      addEventListener: () => {},
      // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
      removeEventListener: () => {},
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Footer design-system link', () => {
  it('links to /design-system as a same-site internal link (no target=_blank)', () => {
    const { container } = render(
      <BreakpointProvider initialIsMobile={false}>
        <Footer />
      </BreakpointProvider>,
    );
    const links = [...container.querySelectorAll('a[href="/design-system"]')];
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      expect(a.getAttribute('target')).not.toBe('_blank');
    }
  });
});
