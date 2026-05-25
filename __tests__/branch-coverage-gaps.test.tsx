// __tests__/branch-coverage-gaps.test.tsx
// Targeted tests to close branch coverage gaps identified by v8 coverage.
// Each describe block names the component/function and the specific branch it covers.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

// ---------------------------------------------------------------------------
// LivePerfSection — PerfBody non-fallback branches
// Existing tests only exercise the error path (getScores throws).
// These cover: isFallback=false, lastCheck ternary true/false branches.
// ---------------------------------------------------------------------------

const getScoresMock = vi.fn();
vi.mock('@/lib/lighthouse-scores', () => ({
  getScores: getScoresMock,
  LIGHTHOUSE_FALLBACK: {
    performance: 0,
    accessibility: 0,
    bestPractices: 0,
    seo: 0,
    fetchedAt: '—',
  },
}));

describe('LivePerfSection — PerfBody with real scores (non-fallback branches)', () => {
  afterEach(() => {
    vi.resetModules();
    getScoresMock.mockReset();
  });

  async function renderPerfData(): Promise<string> {
    const { PerfData } = await import('@/components/sections/LivePerfSection/LivePerfSection');
    const element = await PerfData();
    return renderToStaticMarkup(element);
  }

  it('renders score values (not dashes) when getScores returns real data', async () => {
    getScoresMock.mockResolvedValue({
      performance: 98,
      accessibility: 100,
      bestPractices: 95,
      seo: 100,
      fetchedAt: '2026-05-25T12:00:00.000Z',
    });
    const html = await renderPerfData();
    // Non-fallback path renders actual numeric values
    expect(html).toContain('98');
    expect(html).toContain('100');
    // The non-fallback source label
    expect(html).toContain('PageSpeed Insights');
  });

  it('renders lastCheck as UTC string when fetchedAt is a valid ISO date', async () => {
    getScoresMock.mockResolvedValue({
      performance: 95,
      accessibility: 100,
      bestPractices: 95,
      seo: 100,
      fetchedAt: '2026-05-25T12:00:00.000Z',
    });
    const html = await renderPerfData();
    // lastCheck ternary true branch: valid date -> toUTCString()
    expect(html).toContain('LAST_CHECK');
    expect(html).not.toContain('LAST_CHECK: —');
  });

  it('renders lastCheck as dash when fetchedAt is the fallback dash string', async () => {
    // This hits the `fetchedAt !== '—'` false branch in lastCheck ternary.
    // When isFallback is true (fetchedAt === '—'), lastCheck renders '—'.
    getScoresMock.mockResolvedValue({
      performance: 0,
      accessibility: 0,
      bestPractices: 0,
      seo: 0,
      fetchedAt: '—',
    });
    const html = await renderPerfData();
    expect(html).toContain('LAST_CHECK: —');
  });
});

// ---------------------------------------------------------------------------
// AiMetricsSection — lastRunLabel NaN branch
// The existing test passes a valid ISO string. This covers the NaN path:
// if new Date(iso).getTime() is NaN, return iso unchanged.
// ---------------------------------------------------------------------------

describe('AiMetricsSection — lastRunLabel NaN guard branch', () => {
  const getAskMetricsMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@/content/ask-metrics', () => ({
      getAskMetrics: getAskMetricsMock,
    }));
  });

  afterEach(() => {
    vi.resetModules();
    getAskMetricsMock.mockReset();
  });

  it('renders lastRun verbatim when the ISO string is unparseable', async () => {
    getAskMetricsMock.mockResolvedValue({
      evalPassRate: 0.95,
      jailbreakResistance: 1.0,
      p95LatencyMs: 2840,
      costPerAnswer: 0.0021,
      lastRun: 'not-a-date',
    });
    const { AiMetricsData } = await import(
      '@/components/sections/AiMetricsSection/AiMetricsSection'
    );
    const element = await AiMetricsData();
    const html = renderToStaticMarkup(element);
    // The unparseable string is returned verbatim by lastRunLabel
    expect(html).toContain('not-a-date');
  });
});

// ---------------------------------------------------------------------------
// AppShell — isMobile=true ternary branches (lines 44-51)
// Existing test stubs useBreakpoint with isMobile=false only.
// Cover isMobile=true to hit the other side of the 3 ternaries.
// ---------------------------------------------------------------------------

describe('AppShell — isMobile=true prop branches', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@/lib/use-breakpoint.client', () => ({
      useBreakpoint: () => ({ isMobile: true }),
    }));
    vi.doMock('@/components/responsive/MatrixRain', () => ({
      MatrixRain: ({ fontSize, speed }: { fontSize: number; speed: number }) =>
        createElement('div', { 'data-font-size': fontSize, 'data-speed': speed }),
    }));
    vi.doMock('@/components/responsive/CRTOverlay', () => ({ CRTOverlay: () => null }));
    vi.doMock('@/components/responsive/DesktopTopbar', () => ({ DesktopTopbar: () => null }));
    vi.doMock('@/components/responsive/StatusBar', () => ({ StatusBar: () => null }));
    vi.doMock('@/components/responsive/MobileTitleBar', () => ({ MobileTitleBar: () => null }));
    vi.doMock('@/components/responsive/Dock', () => ({ Dock: () => null }));
    vi.doMock('@/components/client/ToTopButton', () => ({ ToTopButton: () => null }));
    vi.doMock('@/components/ErrorBoundary', () => ({
      ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
    }));
  });

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('renders AppShell with isMobile=true without throwing', async () => {
    const { AppShell } = await import('@/components/AppShell/AppShell.client');
    mounted = await mountClient(createElement(AppShell, null));
    expect(mounted.container).not.toBeNull();
    // The MatrixRain stub receives isMobile=true ternary values (fontSize=14, speed=0.6)
    const matrixEl = mounted.container.querySelector('[data-font-size]');
    expect(matrixEl?.getAttribute('data-font-size')).toBe('14');
    expect(matrixEl?.getAttribute('data-speed')).toBe('0.6');
  });
});

// ---------------------------------------------------------------------------
// ManPageContent — isMobile=true branch
// ManPageSection.tsx line 10: `isMobile ? <ManPageMobile /> : <ManPageDesktop />`
// section-mobile-variants.test.ts covers ManPageContent with mobile UA via
// next/headers mock. This test covers the same branch via direct @/lib/ua mock.
// (The isMobile=false path is covered by section-viewport-variants.test.ts
// which renders the Suspense fallback = ManPageDesktop synchronously.)
// ---------------------------------------------------------------------------

describe('ManPageContent — isMobile=true branch (renders ManPageMobile)', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('renders ManPageMobile when getIsMobile returns true', async () => {
    vi.resetModules();
    vi.doMock('@/lib/ua', () => ({
      getIsMobile: vi.fn().mockResolvedValue(true),
    }));
    const { ManPageContent } = await import('@/components/sections/ManPageSection/ManPageSection');
    const element = await ManPageContent();
    const html = renderToStaticMarkup(element);
    // ManPageMobile renders a data-testid="manpage-mobile" attribute
    expect(html).toContain('manpage-mobile');
  });
});

// ---------------------------------------------------------------------------
// FooterLazy — IntersectionObserver undefined guard branch (lines 44-47)
// When IntersectionObserver is not available, the effect short-circuits and
// calls setMounted(true) immediately. This path is separate from the normal
// IO observation path covered by Footer.test.tsx.
// ---------------------------------------------------------------------------

describe('FooterLazy — IntersectionObserver undefined guard (branch lines 44-47)', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
    // Remove IntersectionObserver to force the undefined guard branch
    vi.stubGlobal('IntersectionObserver', undefined);
    // Stub the dynamic Footer to avoid next/dynamic complexity in jsdom
    vi.doMock('next/dynamic', () => ({
      default: () => () => null,
    }));
  });

  afterEach(() => {
    mounted?.unmount();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('mounts FooterLazy immediately when IntersectionObserver is undefined', async () => {
    const { flushMicrotasks } = await import('./helpers/render');
    const { FooterLazy } = await import('@/components/sections/Footer');
    mounted = await mountClient(createElement(FooterLazy));
    // Flush effects so the setMounted(true) call from the IO-undefined guard commits
    await flushMicrotasks();
    // When mounted=true, the sentinel is replaced; container should not have sentinel
    const sentinel = mounted.container.querySelector('[data-testid="footer-lazy-sentinel"]');
    // After setMounted(true), Footer is rendered (our stub renders null), not sentinel
    expect(sentinel).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ManPageSection — Suspense fallback branch
// ManPageSection (sync wrapper) renders <Suspense fallback={<ManPageDesktop />}>
// via renderToStaticMarkup, the async RSC suspends and the fallback renders.
// This covers the branch at ManPageSection render time.
// ---------------------------------------------------------------------------

describe('ManPageSection — Suspense fallback branch', () => {
  it('renders the desktop fallback synchronously via Suspense', async () => {
    const { createElement: ce } = await import('react');
    const { ManPageSection } = await import('@/components/sections/ManPageSection/ManPageSection');
    // renderToStaticMarkup renders Suspense fallback synchronously when
    // the async child suspends — this exercises ManPageSection's render path.
    const html = renderToStaticMarkup(ce(ManPageSection));
    // The fallback is ManPageDesktop which renders a <pre> element
    expect(html).toContain('NAME');
  });
});

// ---------------------------------------------------------------------------
// ErrorBoundary — custom fallback branch
// Lines 32-39: the `this.props.fallback ?? <default>` ternary.
// Existing tests exercise the default fallback. Cover explicit fallback prop.
// React 19 in jsdom re-throws errors from error boundaries in act() — wrap
// in try/catch and use renderToStaticMarkup (no act wrapping) to exercise
// the path without triggering the re-throw.
// ---------------------------------------------------------------------------

describe('ErrorBoundary — custom fallback prop branch', () => {
  it('renders the custom fallback when provided and hasError is true', async () => {
    // Import directly from the client file to avoid the doMock on the barrel
    // registered by the AppShell describe block above.
    const { ErrorBoundary } = await import('@/components/ErrorBoundary/ErrorBoundary.client');

    // Subclass with pre-set error state avoids triggering an actual render-time
    // throw, which React 19 act() re-throws even when a boundary catches it.
    // The fallback ternary at render() line 50 is exercised without throw noise.
    class ErroredBoundary extends ErrorBoundary {
      override state = { hasError: true };
    }

    const customFallback = createElement('div', { 'data-testid': 'custom-fallback' }, 'custom');
    const { container, unmount } = await mountClient(
      // biome-ignore lint/suspicious/noExplicitAny: children:ReactNode required by prop type, test-only
      createElement(ErroredBoundary, { fallback: customFallback } as any, createElement('span')),
    );

    expect(container.querySelector('[data-testid="custom-fallback"]')).not.toBeNull();
    unmount();
  });
});

// ---------------------------------------------------------------------------
// ToTopButton — visible=true branch (className ternary, line 22)
// The visible state is driven by scrollY > 400 in a useEffect.
// jsdom starts with scrollY=0 so visible=false initially (covered by existing test).
// Set scrollY > 400 on window before mounting, then dispatch scroll event so
// the useEffect's onScroll call picks it up and flips visible=true.
// ---------------------------------------------------------------------------

describe('ToTopButton — visible=true className branch', () => {
  let mounted: MountedClient;
  const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');

  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 500, writable: true, configurable: true });
  });

  afterEach(() => {
    mounted?.unmount();
    if (originalScrollY) {
      Object.defineProperty(window, 'scrollY', originalScrollY);
    } else {
      Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
    }
  });

  it('applies the show class to the button when scrollY > 400', async () => {
    const styles = await import('@/components/client/ToTopButton/ToTopButton.module.css');
    const { ToTopButton } = await import('@/components/client/ToTopButton/ToTopButton');
    mounted = await mountClient(createElement(ToTopButton));
    const btn = mounted.container.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('aria-label')).toBe('back to top');
    // useEffect calls onScroll() immediately at mount — with scrollY=500, visible
    // flips to true and the show class is applied. This is the branch under test.
    // biome-ignore lint/style/noNonNullAssertion: CSS modules are identity-mapped in jsdom — key always resolves
    expect(btn?.classList.contains(styles.default.show!)).toBe(true);
  });
});
