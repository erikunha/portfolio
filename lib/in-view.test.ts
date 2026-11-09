import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observeInView, supportsInView, WHEN_UNSUPPORTED } from './in-view';

type Callback = (entries: Array<{ target: Element; isIntersecting: boolean }>) => void;

let observers: FakeIntersectionObserver[] = [];

class FakeIntersectionObserver {
  disconnected = false;
  observed: Element[] = [];

  constructor(
    readonly callback: Callback,
    readonly options?: Record<string, unknown>,
  ) {
    observers.push(this);
  }
  observe(target: Element) {
    this.observed.push(target);
  }
  disconnect() {
    this.disconnected = true;
  }
}

const first = () => observers[0] as FakeIntersectionObserver;

beforeEach(() => {
  observers = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('observeInView', () => {
  it('observes every target on one observer and hands the entries to the callback', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    const callback = vi.fn();

    observeInView([a, b], callback);

    expect(observers).toHaveLength(1);
    expect(first().observed).toEqual([a, b]);
    const entries = [{ target: a, isIntersecting: true }];
    first().callback(entries);
    expect(callback).toHaveBeenCalledWith(entries, expect.any(Function));
  });

  it('accepts a single element', () => {
    const a = document.createElement('div');

    observeInView(a, vi.fn());

    expect(first().observed).toEqual([a]);
  });

  it('passes the observer options through and keeps its own option out of them', () => {
    observeInView(document.createElement('div'), vi.fn(), {
      rootMargin: '400px',
      whenUnsupported: WHEN_UNSUPPORTED.Intersecting,
    });

    expect(first().options).toEqual({ rootMargin: '400px' });
  });

  it('disconnects when the returned cleanup runs', () => {
    const cleanup = observeInView(document.createElement('div'), vi.fn());

    cleanup();

    expect(first().disconnected).toBe(true);
  });

  it('lets the callback stop observing', () => {
    const target = document.createElement('div');
    observeInView(target, (_entries, stop) => stop());

    first().callback([{ target, isIntersecting: true }]);

    expect(first().disconnected).toBe(true);
  });

  describe('without IntersectionObserver', () => {
    beforeEach(() => {
      vi.stubGlobal('IntersectionObserver', undefined);
    });

    it('reports support', () => {
      expect(supportsInView()).toBe(false);
    });

    it('stays silent by default, so nothing is ever reported as hidden', () => {
      const callback = vi.fn();

      const cleanup = observeInView(document.createElement('div'), callback);
      cleanup();

      expect(callback).not.toHaveBeenCalled();
    });

    it('reports every target as intersecting at once when asked to', () => {
      const a = document.createElement('div');
      const b = document.createElement('div');
      const callback = vi.fn();

      observeInView([a, b], callback, { whenUnsupported: WHEN_UNSUPPORTED.Intersecting });

      expect(callback).toHaveBeenCalledOnce();
      expect(callback.mock.calls[0]?.[0]).toEqual([
        { target: a, isIntersecting: true },
        { target: b, isIntersecting: true },
      ]);
    });
  });
});
