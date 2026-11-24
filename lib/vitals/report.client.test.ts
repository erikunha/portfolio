import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Report = (metric: unknown) => void;
const handlers: Record<string, Report> = {};

vi.mock('web-vitals/attribution', () => ({
  onLCP: (cb: Report) => {
    handlers.LCP = cb;
  },
  onINP: (cb: Report) => {
    handlers.INP = cb;
  },
  onCLS: (cb: Report) => {
    handlers.CLS = cb;
  },
}));

const lcp = {
  name: 'LCP',
  value: 2100,
  navigationType: 'navigate',
  attribution: {
    target: 'section#bio>h1',
    timeToFirstByte: 100,
    resourceLoadDelay: 0,
    resourceLoadDuration: 0,
    elementRenderDelay: 2000,
  },
};
const cls = { name: 'CLS', value: 0.05, navigationType: 'navigate', attribution: {} };
const ttfb = { name: 'TTFB', value: 80, navigationType: 'navigate', attribution: {} };

let idleTasks: (() => void)[];
let beacon: ReturnType<typeof vi.fn>;

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
}

class RecordingBlob {
  constructor(
    readonly parts: string[],
    readonly options: { type: string },
  ) {}
}

async function beaconBody(call = 0): Promise<{ url: string; json: Record<string, unknown> }> {
  const [url, blob] = beacon.mock.calls[call] as [string, RecordingBlob];
  expect(blob.options.type).toBe('application/json');
  return { url, json: JSON.parse(blob.parts.join('')) };
}

async function start() {
  const { startVitalsReporting } = await import('@/lib/vitals/report.client');
  startVitalsReporting();
  return startVitalsReporting;
}

async function runIdleAndLoad() {
  for (const task of idleTasks.splice(0)) task();
  await vi.dynamicImportSettled();
}

describe('startVitalsReporting', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    for (const key of Object.keys(handlers)) delete handlers[key];
    idleTasks = [];
    beacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: beacon });
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: (task: () => void) => idleTasks.push(task),
    });
    vi.stubGlobal('PerformanceObserver', class {});
    vi.stubGlobal('Blob', RecordingBlob);
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
    setVisibility('visible');
    window.history.replaceState({}, '', '/pt/cv?secret=1#frag');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, 'requestIdleCallback');
  });

  it('loads and registers nothing until the browser is idle', async () => {
    await start();
    await vi.dynamicImportSettled();

    expect(handlers.LCP).toBeUndefined();
    expect(idleTasks).toHaveLength(1);

    await runIdleAndLoad();
    expect(handlers.LCP).toBeDefined();
    expect(handlers.INP).toBeDefined();
    expect(handlers.CLS).toBeDefined();
  });

  it('waits for the load event when the document is still loading', async () => {
    Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' });
    await start();

    expect(idleTasks).toHaveLength(0);
    window.dispatchEvent(new Event('load'));
    expect(idleTasks).toHaveLength(1);
  });

  it('sends one beacon with every collected metric when the page is hidden, path without query', async () => {
    await start();
    await runIdleAndLoad();
    handlers.LCP?.(lcp);
    handlers.CLS?.(cls);

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(beacon).not.toHaveBeenCalled();
    vi.runAllTimers();

    expect(beacon).toHaveBeenCalledTimes(1);
    const { url, json } = await beaconBody();
    expect(url).toBe('/api/vitals');
    expect(json).toMatchObject({ path: '/pt/cv', vw: window.innerWidth });
    expect(JSON.stringify(json)).not.toContain('secret');
    expect(json.metrics).toEqual([
      expect.objectContaining({ name: 'LCP', value: 2100, tag: 'h1', landmark: 'bio' }),
      expect.objectContaining({ name: 'CLS', value: 0.05 }),
    ]);
  });

  it('sends on pagehide without waiting for a timer', async () => {
    await start();
    await runIdleAndLoad();
    handlers.CLS?.(cls);

    window.dispatchEvent(new Event('pagehide'));

    expect(beacon).toHaveBeenCalledTimes(1);
  });

  it('reports a metric once per page view and sends nothing when none was collected', async () => {
    await start();
    await runIdleAndLoad();
    window.dispatchEvent(new Event('pagehide'));
    expect(beacon).not.toHaveBeenCalled();

    handlers.CLS?.(cls);
    handlers.CLS?.({ ...cls, value: 0.9 });
    handlers.CLS?.(ttfb);
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('pagehide'));

    expect(beacon).toHaveBeenCalledTimes(1);
    expect((await beaconBody()).json.metrics).toEqual([
      expect.objectContaining({ name: 'CLS', value: 0.05 }),
    ]);
  });

  it('starts once however many times it is called', async () => {
    const startAgain = await start();
    startAgain();

    expect(idleTasks).toHaveLength(1);
  });

  it('does nothing without sendBeacon or PerformanceObserver', async () => {
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: undefined });
    await start();
    expect(idleTasks).toHaveLength(0);

    vi.resetModules();
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: beacon });
    vi.stubGlobal('PerformanceObserver', undefined);
    Reflect.deleteProperty(window, 'PerformanceObserver');
    await start();
    expect(idleTasks).toHaveLength(0);
  });

  it('falls back to a timer when requestIdleCallback is missing', async () => {
    Reflect.deleteProperty(window, 'requestIdleCallback');
    await start();
    vi.advanceTimersByTime(2000);
    await vi.dynamicImportSettled();

    expect(handlers.LCP).toBeDefined();
  });
});
