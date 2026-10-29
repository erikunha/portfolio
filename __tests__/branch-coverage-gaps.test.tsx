import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEASURED_FORMAT, measured } from '@/content/measured';
import { MeasuredSchema } from '@/content/schemas';
import { type MountedClient, mountClient } from './helpers/render';

const getScoresMock = vi.fn();
vi.mock('@/lib/lighthouse-scores', () => ({
  getScores: getScoresMock,
  LIGHTHOUSE_TTL_S: 90_000,
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
    expect(html).toContain(measured.psi.url);
    expect(html).toContain('aria-valuenow="98"');
  });

  it('renders the PSI timestamp as a semantic time when fetchedAt is valid', async () => {
    getScoresMock.mockResolvedValue({
      performance: 95,
      accessibility: 100,
      bestPractices: 95,
      seo: 100,
      fetchedAt: '2026-05-25T12:00:00.000Z',
    });
    const html = await renderPerfData();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('time')?.getAttribute('datetime')).toBe('2026-05-25T12:00:00.000Z');
    expect(doc.querySelector('time')?.textContent).toBe('2026-05-25');
  });

  it('marks PSI unavailable without zero scores or a time for fallback data', async () => {
    getScoresMock.mockResolvedValue({
      performance: 0,
      accessibility: 0,
      bestPractices: 0,
      seo: 0,
      fetchedAt: '—',
    });
    const html = await renderPerfData();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.body.textContent).toContain(measured.unavailable);
    expect(doc.querySelector('time')).toBeNull();
    expect(doc.querySelectorAll('[aria-valuenow]')).toHaveLength(0);
    expect(doc.querySelectorAll('.measured-value')).toHaveLength(4);
    for (const value of doc.querySelectorAll('.measured-value')) {
      expect(value.textContent).toBe('—/100');
    }
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
    expect(html).toContain(measured.unknownTimestamp);
    expect(html).toContain('95%');
    expect(html).not.toContain('<time');
  });
});

function MatrixRainStub({ fontSize, speed }: { fontSize: number; speed: number }) {
  return createElement('div', { 'data-font-size': fontSize, 'data-speed': speed });
}

function NullStub() {
  return null;
}

function PassThroughStub({ children }: { children: React.ReactNode }) {
  return children;
}

describe('AppShell — isMobile=true prop branches', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@/lib/use-breakpoint.client', () => ({
      useBreakpoint: () => ({ isMobile: true }),
    }));
    vi.doMock('@/components/responsive/MatrixRain', () => ({
      MatrixRain: MatrixRainStub,
    }));
    vi.doMock('@/components/responsive/CRTOverlay', () => ({ CRTOverlay: NullStub }));
    vi.doMock('@/components/responsive/DesktopTopbar', () => ({ DesktopTopbar: NullStub }));
    vi.doMock('@/components/responsive/StatusBar', () => ({ StatusBar: NullStub }));
    vi.doMock('@/components/responsive/MobileTitleBar', () => ({ MobileTitleBar: NullStub }));
    vi.doMock('@/components/responsive/Dock', () => ({ Dock: NullStub }));
    vi.doMock('@/components/client/ToTopButton', () => ({ ToTopButton: NullStub }));
    vi.doMock('@/components/ErrorBoundary', () => ({
      ErrorBoundary: PassThroughStub,
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

describe('Measured content validation', () => {
  it.each(['empty', 'locale'])('rejects empty format copy for %s', (field) => {
    expect(
      MeasuredSchema.safeParse({
        ...measured,
        format: { ...MEASURED_FORMAT, [field]: '' },
      }).success,
    ).toBe(false);
  });
});

describe('Project receipt narrow layout contract', () => {
  it('lets both receipt columns shrink and long values wrap at 320px', () => {
    // behavioral-test-allow: checks the shipped CSS layout contract because jsdom has no layout engine
    const css = readFileSync('app/css/components.css', 'utf8');
    const row = css.match(/\.project-receipts li\s*\{([^}]+)\}/)?.[1];
    const value = css.match(/\.receipt-value\s*\{([^}]+)\}/)?.[1];
    const metric = css.match(/\.receipt-metric\s*\{([^}]+)\}/)?.[1];
    expect(row).toMatch(/grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    for (const cell of [value, metric]) {
      expect(cell).toMatch(/overflow-wrap:\s*anywhere/);
      expect(cell).not.toMatch(/white-space:\s*nowrap/);
    }
  });
});
