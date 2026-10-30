import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TypeReveal } from './TypeReveal.client';

const navigation = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;

const observers: MockObserver[] = [];

class MockObserver {
  callback: Callback;
  options: IntersectionObserverInit | undefined;
  observed = new Set<Element>();
  unobserve = vi.fn((el: Element) => this.observed.delete(el));
  disconnect = vi.fn(() => this.observed.clear());
  constructor(callback: Callback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    observers.push(this);
  }
  observe(el: Element) {
    this.observed.add(el);
  }
  fire(el: Element, isIntersecting: boolean) {
    this.callback([{ target: el, isIntersecting }]);
  }
}

function mount(html: string) {
  document.body.innerHTML = html;
  return render(<TypeReveal />, {
    container: document.body.appendChild(document.createElement('div')),
  });
}

function setMotion(on: boolean) {
  localStorage.setItem('erik.motion', on ? 'on' : 'off');
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal('IntersectionObserver', MockObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.classList.remove('type-reveal-ready');
  document.body.innerHTML = '';
});

describe('TypeReveal', () => {
  it('adds is-typed when the observer reports intersection', () => {
    setMotion(true);
    mount('<h2 data-type-reveal id="a">About</h2><h2 data-type-reveal id="b">Work</h2>');
    const a = document.getElementById('a') as HTMLElement;
    const b = document.getElementById('b') as HTMLElement;
    expect(a.classList.contains('is-typed')).toBe(false);
    act(() => observers[0]?.fire(a, true));
    expect(a.classList.contains('is-typed')).toBe(true);
    expect(b.classList.contains('is-typed')).toBe(false);
  });

  it('ignores entries that are not intersecting', () => {
    setMotion(true);
    mount('<h2 data-type-reveal id="a">About</h2>');
    const a = document.getElementById('a') as HTMLElement;
    act(() => observers[0]?.fire(a, false));
    expect(a.classList.contains('is-typed')).toBe(false);
  });

  it('unobserves an element after revealing it', () => {
    setMotion(true);
    mount('<h2 data-type-reveal id="a">About</h2>');
    const a = document.getElementById('a') as HTMLElement;
    act(() => observers[0]?.fire(a, true));
    expect(observers[0]?.unobserve).toHaveBeenCalledWith(a);
    expect(observers[0]?.observed.has(a)).toBe(false);
  });

  it('sets --type-chars from the text length', () => {
    setMotion(true);
    mount('<h2 data-type-reveal id="a">  Hello world </h2>');
    const a = document.getElementById('a') as HTMLElement;
    expect(a.style.getPropertyValue('--type-chars')).toBe('11');
  });

  it('marks the root ready so hiding only applies after hydration', () => {
    setMotion(true);
    mount('<h2 data-type-reveal>About</h2>');
    expect(document.documentElement.classList.contains('type-reveal-ready')).toBe(true);
  });

  it('fires on the visible caret strip once it is inside the shrunken viewport', () => {
    setMotion(true);
    mount('<h2 data-type-reveal>About</h2>');
    expect(observers[0]?.options?.threshold).toBe(0);
    expect(observers[0]?.options?.rootMargin).toMatch(/^0px 0px -\d+% 0px$/);
  });

  it('marks every element typed at once when motion is off', () => {
    setMotion(false);
    mount('<h2 data-type-reveal id="a">About</h2><p data-type-reveal id="b">$ ls</p>');
    expect(document.getElementById('a')?.classList.contains('is-typed')).toBe(true);
    expect(document.getElementById('b')?.classList.contains('is-typed')).toBe(true);
    expect(observers).toHaveLength(0);
  });

  it('reveals everything when the motion preference turns off later', () => {
    setMotion(true);
    mount('<h2 data-type-reveal id="a">About</h2>');
    act(() => {
      window.dispatchEvent(new CustomEvent('motionchange', { detail: { on: false } }));
    });
    expect(document.getElementById('a')?.classList.contains('is-typed')).toBe(true);
  });

  it('reveals everything when IntersectionObserver is unavailable', () => {
    setMotion(true);
    vi.stubGlobal('IntersectionObserver', undefined);
    mount('<h2 data-type-reveal id="a">About</h2>');
    expect(document.getElementById('a')?.classList.contains('is-typed')).toBe(true);
  });

  it('disconnects on unmount', () => {
    setMotion(true);
    const { unmount } = mount('<h2 data-type-reveal>About</h2>');
    unmount();
    expect(observers[0]?.disconnect).toHaveBeenCalled();
  });

  it('observes elements of a new route after client navigation', () => {
    setMotion(true);
    const { rerender } = mount('<h2 data-type-reveal id="a">About</h2>');
    const fresh = document.createElement('h2');
    fresh.dataset.typeReveal = '';
    fresh.textContent = 'Summary';
    document.body.prepend(fresh);
    navigation.pathname = '/summary';
    rerender(<TypeReveal />);
    const latest = observers.at(-1);
    expect(latest?.observed.has(fresh)).toBe(true);
    act(() => latest?.fire(fresh, true));
    expect(fresh.classList.contains('is-typed')).toBe(true);
    navigation.pathname = '/';
  });

  it('renders nothing itself', () => {
    setMotion(true);
    const { container } = mount('');
    expect(container.innerHTML).toBe('');
  });
  it('marks elements revealed without motion as static, so enabling motion later does not replay them', () => {
    setMotion(false);
    mount('<h2 data-type-reveal id="a">About</h2>');
    const a = document.getElementById('a') as HTMLElement;
    expect(a.classList.contains('is-typed')).toBe(true);
    expect(a.classList.contains('is-static')).toBe(true);
  });

  it('marks typed and not-yet-typed elements static when motion turns off mid-page, so re-enabling motion replays neither', () => {
    setMotion(true);
    mount('<h2 data-type-reveal id="a">About</h2><h2 data-type-reveal id="b">Work</h2>');
    const a = document.getElementById('a') as HTMLElement;
    const b = document.getElementById('b') as HTMLElement;
    act(() => observers[0]?.fire(a, true));
    act(() => {
      window.dispatchEvent(new CustomEvent('motionchange', { detail: { on: false } }));
    });
    expect(a.classList.contains('is-static')).toBe(true);
    expect(b.classList.contains('is-typed')).toBe(true);
    expect(b.classList.contains('is-static')).toBe(true);
  });
});
