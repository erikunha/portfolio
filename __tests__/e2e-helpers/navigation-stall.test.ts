import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isSameDocumentTarget,
  isWebKitCoopNavigationStall,
  NAVIGATION_STALL_WINDOW_MS,
  type NavigationStallObservation,
  navigateWithStallRecovery,
} from '../../tests/e2e/_helpers/navigation-stall';

const TARGET = '/links/en';
const DOCUMENT_URL = 'http://localhost:3000/links/en';

const stalled: NavigationStallObservation = {
  browserName: 'webkit',
  targetUrl: TARGET,
  pageUrl: 'about:blank',
  documentRequest: { url: DOCUMENT_URL, responded: false, failed: false },
  recoveredBefore: false,
};

function observed(change: Partial<NavigationStallObservation>): NavigationStallObservation {
  return { ...stalled, ...change };
}

describe('isWebKitCoopNavigationStall', () => {
  it('recognises the stall: WebKit, a started document request with no response, about:blank', () => {
    expect(isWebKitCoopNavigationStall(stalled)).toBe(true);
  });

  it('leaves a slow response alone once its headers have arrived', () => {
    const documentRequest = { url: DOCUMENT_URL, responded: true, failed: false };
    expect(isWebKitCoopNavigationStall(observed({ documentRequest }))).toBe(false);
  });

  it('leaves a navigation alone before its document request has started', () => {
    expect(isWebKitCoopNavigationStall(observed({ documentRequest: undefined }))).toBe(false);
  });

  it('leaves a failed document request alone, so the goto rejects with its network error', () => {
    const documentRequest = { url: DOCUMENT_URL, responded: false, failed: true };
    expect(isWebKitCoopNavigationStall(observed({ documentRequest }))).toBe(false);
  });

  it('never recovers outside WebKit', () => {
    for (const browserName of ['chromium', 'firefox', undefined]) {
      expect(isWebKitCoopNavigationStall(observed({ browserName }))).toBe(false);
    }
  });

  it('never recovers a second stall in the same test', () => {
    expect(isWebKitCoopNavigationStall(observed({ recoveredBefore: true }))).toBe(false);
  });

  it('leaves a page that already left about:blank alone', () => {
    expect(isWebKitCoopNavigationStall(observed({ pageUrl: 'http://localhost:3000/' }))).toBe(
      false,
    );
  });

  it('leaves a pending document request for another URL alone', () => {
    const documentRequest = { url: 'http://localhost:3000/pt', responded: false, failed: false };
    expect(isWebKitCoopNavigationStall(observed({ documentRequest }))).toBe(false);
  });
});

describe('isSameDocumentTarget', () => {
  it('resolves a root-relative target against the request origin', () => {
    expect(isSameDocumentTarget('/links/en', DOCUMENT_URL)).toBe(true);
    expect(isSameDocumentTarget('/links', DOCUMENT_URL)).toBe(false);
  });

  it('compares an absolute target as is and ignores the fragment, which is never sent', () => {
    expect(isSameDocumentTarget(DOCUMENT_URL, DOCUMENT_URL)).toBe(true);
    expect(isSameDocumentTarget('/links/en#sec-feed', DOCUMENT_URL)).toBe(true);
    expect(isSameDocumentTarget('https://localhost:3000/links/en', DOCUMENT_URL)).toBe(false);
    expect(isSameDocumentTarget('/links/en?lang=pt', DOCUMENT_URL)).toBe(false);
  });

  it('refuses a request URL that does not parse', () => {
    expect(isSameDocumentTarget('/links/en', 'not a url')).toBe(false);
  });
});

describe('navigateWithStallRecovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function never<T>(): Promise<T> {
    return new Promise<T>(() => undefined);
  }

  it('returns a navigation that settles inside the window without observing it', async () => {
    const observe = vi.fn(() => stalled);
    const recordRecovery = vi.fn();
    const navigate = vi.fn(async () => 'first');
    const result = navigateWithStallRecovery({
      navigate,
      observe,
      recordRecovery,
      stallWindowMs: NAVIGATION_STALL_WINDOW_MS,
    });
    await expect(result).resolves.toBe('first');
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(observe).not.toHaveBeenCalled();
    expect(recordRecovery).not.toHaveBeenCalled();
  });

  it('passes a failure inside the window through unchanged', async () => {
    const failure = new Error('net::ERR_CONNECTION_REFUSED');
    const navigate = vi.fn(() => Promise.reject(failure));
    const result = navigateWithStallRecovery({
      navigate,
      observe: () => stalled,
      recordRecovery: vi.fn(),
      stallWindowMs: NAVIGATION_STALL_WINDOW_MS,
    });
    await expect(result).rejects.toBe(failure);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('navigates once more and records it when the stall holds at the end of the window', async () => {
    const recordRecovery = vi.fn();
    const navigate = vi.fn<() => Promise<string>>();
    navigate.mockImplementationOnce(never).mockImplementationOnce(async () => 'second');
    const result = navigateWithStallRecovery({
      navigate,
      observe: () => stalled,
      recordRecovery,
      stallWindowMs: NAVIGATION_STALL_WINDOW_MS,
    });
    await vi.advanceTimersByTimeAsync(NAVIGATION_STALL_WINDOW_MS - 1);
    expect(navigate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe('second');
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(recordRecovery).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting on the first navigation when the observation is not the stall', async () => {
    let answer: (value: string) => void = () => undefined;
    const navigate = vi.fn(() => new Promise<string>((resolve) => (answer = resolve)));
    const recordRecovery = vi.fn();
    const slowResponse = observed({
      documentRequest: { url: DOCUMENT_URL, responded: true, failed: false },
    });
    const result = navigateWithStallRecovery({
      navigate,
      observe: () => slowResponse,
      recordRecovery,
      stallWindowMs: NAVIGATION_STALL_WINDOW_MS,
    });
    await vi.advanceTimersByTimeAsync(NAVIGATION_STALL_WINDOW_MS * 4);
    answer('slow but answered');
    await expect(result).resolves.toBe('slow but answered');
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(recordRecovery).not.toHaveBeenCalled();
  });

  it('lets the second attempt fail as it is, with no third attempt', async () => {
    const failure = new Error('page.goto: Timeout 30000ms exceeded.');
    const navigate = vi.fn<() => Promise<string>>();
    navigate.mockImplementationOnce(never).mockImplementationOnce(() => Promise.reject(failure));
    const result = navigateWithStallRecovery({
      navigate,
      observe: () => stalled,
      recordRecovery: vi.fn(),
      stallWindowMs: NAVIGATION_STALL_WINDOW_MS,
    });
    const settled = expect(result).rejects.toBe(failure);
    await vi.advanceTimersByTimeAsync(NAVIGATION_STALL_WINDOW_MS);
    await settled;
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it('does not surface the abandoned first attempt when it rejects later', async () => {
    let interrupt: (error: Error) => void = () => undefined;
    const navigate = vi.fn<() => Promise<string>>();
    navigate
      .mockImplementationOnce(() => new Promise<string>((_, reject) => (interrupt = reject)))
      .mockImplementationOnce(async () => 'second');
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const result = navigateWithStallRecovery({
        navigate,
        observe: () => stalled,
        recordRecovery: vi.fn(),
        stallWindowMs: NAVIGATION_STALL_WINDOW_MS,
      });
      await vi.advanceTimersByTimeAsync(NAVIGATION_STALL_WINDOW_MS);
      await expect(result).resolves.toBe('second');
      interrupt(new Error('Navigation is interrupted by another navigation'));
      await vi.advanceTimersByTimeAsync(0);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('outlasts the slowest healthy COOP process swap measured, the gap in which a healthy navigation looks stalled', () => {
    const SLOWEST_HEALTHY_SWAP_GAP_MS = 4976;
    expect(NAVIGATION_STALL_WINDOW_MS).toBeGreaterThan(SLOWEST_HEALTHY_SWAP_GAP_MS);
  });
});
