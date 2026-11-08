import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAUSE_REASON, pauseWhileHidden } from './pause-when-hidden';

type Callback = (entries: Array<{ target: Element; isIntersecting: boolean }>) => void;

let observers: FakeIntersectionObserver[] = [];

class FakeIntersectionObserver {
  disconnected = false;
  observe = vi.fn();

  constructor(readonly callback: Callback) {
    observers.push(this);
  }
  disconnect() {
    this.disconnected = true;
  }
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

const host = document.createElement('div');

beforeEach(() => {
  observers = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  setHidden(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pauseWhileHidden', () => {
  it('pauses and resumes under the tab reason with the tab', () => {
    const target = { pause: vi.fn(), resume: vi.fn() };
    pauseWhileHidden(host, target);

    setHidden(true);
    expect(target.pause).toHaveBeenCalledWith(PAUSE_REASON.Tab);

    setHidden(false);
    expect(target.resume).toHaveBeenCalledWith(PAUSE_REASON.Tab);
  });

  it('pauses and resumes under the viewport reason with the element', () => {
    const target = { pause: vi.fn(), resume: vi.fn() };
    pauseWhileHidden(host, target);
    const [observer] = observers;

    observer?.callback([{ target: host, isIntersecting: false }]);
    expect(target.pause).toHaveBeenCalledWith(PAUSE_REASON.Viewport);

    observer?.callback([{ target: host, isIntersecting: true }]);
    expect(target.resume).toHaveBeenCalledWith(PAUSE_REASON.Viewport);
  });

  it('observes the host', () => {
    pauseWhileHidden(host, { pause: vi.fn(), resume: vi.fn() });

    expect(observers[0]?.observe).toHaveBeenCalledWith(host);
  });

  it('never pauses for the viewport without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const target = { pause: vi.fn(), resume: vi.fn() };

    const unwatch = pauseWhileHidden(host, target);
    unwatch();

    expect(target.pause).not.toHaveBeenCalled();
    expect(target.resume).not.toHaveBeenCalled();
  });

  it('stops listening and observing once released', () => {
    const target = { pause: vi.fn(), resume: vi.fn() };
    const unwatch = pauseWhileHidden(host, target);

    unwatch();
    setHidden(true);

    expect(observers[0]?.disconnected).toBe(true);
    expect(target.pause).not.toHaveBeenCalled();
  });
});
