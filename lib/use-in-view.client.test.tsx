import { act, render } from '@testing-library/react';
import { type RefObject, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInView } from './use-in-view.client';

type Callback = (entries: Array<{ isIntersecting: boolean }>) => void;

let observers: FakeIntersectionObserver[] = [];

class FakeIntersectionObserver {
  disconnected = false;

  constructor(
    readonly callback: Callback,
    readonly options?: IntersectionObserverInit,
  ) {
    observers.push(this);
  }
  observe = vi.fn();
  disconnect() {
    this.disconnected = true;
  }
}

const observer = () => observers[0] as FakeIntersectionObserver;

type Options = { rootMargin?: string; once?: boolean };

function Probe({
  options,
  onValue,
  attach = true,
}: {
  options?: Options | undefined;
  onValue: (value: boolean) => void;
  attach?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  onValue(useInView(ref as RefObject<Element | null>, options));
  return attach ? <div ref={ref} /> : null;
}

function mount(options?: Options, attach = true) {
  const seen: boolean[] = [];
  const view = render(<Probe options={options} onValue={(v) => seen.push(v)} attach={attach} />);
  return { ...view, latest: () => seen[seen.length - 1] };
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useInView', () => {
  it('starts out of view and follows the observer, with the latest entry of a batch winning', () => {
    const { latest } = mount({ rootMargin: '0px' });
    expect(latest()).toBe(false);
    expect(observer().options).toEqual({ rootMargin: '0px' });

    act(() => observer().callback([{ isIntersecting: false }, { isIntersecting: true }]));
    expect(latest()).toBe(true);

    act(() => observer().callback([{ isIntersecting: true }, { isIntersecting: false }]));
    expect(latest()).toBe(false);
  });

  it('disconnects on unmount', () => {
    const { unmount } = mount();

    unmount();

    expect(observer().disconnected).toBe(true);
  });

  it('counts as in view when the browser has no IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);

    expect(mount().latest()).toBe(true);
    expect(mount({ once: true }).latest()).toBe(true);
  });

  it('counts as in view when there is no element to watch', () => {
    expect(mount(undefined, false).latest()).toBe(true);
    expect(observers).toHaveLength(0);
  });

  describe('once', () => {
    it('stays out of view until a batch intersects, then latches and stops observing', () => {
      const { latest } = mount({ rootMargin: '400px', once: true });

      act(() => observer().callback([{ isIntersecting: false }]));
      expect(latest()).toBe(false);
      expect(observer().disconnected).toBe(false);

      act(() => observer().callback([{ isIntersecting: false }, { isIntersecting: true }]));
      expect(latest()).toBe(true);
      expect(observer().disconnected).toBe(true);
    });
  });
});
