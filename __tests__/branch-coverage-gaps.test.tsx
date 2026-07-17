import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from './helpers/render';

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
    const element = await PerfData({ strategy: 'desktop' });
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
    expect(html).toContain('98');
    expect(html).toContain('100');
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
    expect(html).toContain('LAST_CHECK');
    expect(html).not.toContain('LAST_CHECK: —');
  });

  it('renders lastCheck as dash when fetchedAt is the fallback dash string', async () => {
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

describe('AiMetricsSection — lastRunLabel NaN guard branch', () => {
  const getAskMetricsMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@/lib/ask-metrics', () => ({
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
    expect(html).toContain('not-a-date');
  });
});

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
    const matrixEl = mounted.container.querySelector('[data-font-size]');
    expect(matrixEl?.getAttribute('data-font-size')).toBe('14');
    expect(matrixEl?.getAttribute('data-speed')).toBe('0.6');
  });
});

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
    expect(html).toContain('manpage-mobile');
  });
});

describe('FooterLazy — IntersectionObserver undefined guard (branch lines 44-47)', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('IntersectionObserver', undefined);
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
    await flushMicrotasks();
    const sentinel = mounted.container.querySelector('[data-testid="footer-lazy-sentinel"]');
    expect(sentinel).toBeNull();
  });
});

describe('ManPageSection — Suspense fallback branch', () => {
  it('renders the desktop fallback synchronously via Suspense', async () => {
    const { createElement: ce } = await import('react');
    const { ManPageSection } = await import('@/components/sections/ManPageSection/ManPageSection');
    const html = renderToStaticMarkup(ce(ManPageSection));
    expect(html).toContain('NAME');
  });
});

describe('ErrorBoundary — custom fallback prop branch', () => {
  it('renders the custom fallback when provided and hasError is true', async () => {
    const { ErrorBoundary } = await import('@/components/ErrorBoundary/ErrorBoundary.client');

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
    const { ToTopButton } = await import('@/components/client/ToTopButton/ToTopButton');
    mounted = await mountClient(createElement(ToTopButton));
    const btn = mounted.container.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('aria-label')).toBe('back to top');
    expect(btn?.classList.contains('to-top-show')).toBe(true);
  });
});
