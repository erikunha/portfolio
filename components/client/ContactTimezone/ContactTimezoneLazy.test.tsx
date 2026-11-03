import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactTimezoneLazy } from './ContactTimezoneLazy';

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

let observers: FakeIntersectionObserver[] = [];

class FakeIntersectionObserver {
  disconnected = false;

  constructor(
    readonly callback: ObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    observers.push(this);
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect() {
    this.disconnected = true;
  }
}

const loader = () => observers[0] as FakeIntersectionObserver;

const STATIC_PANEL = <div data-testid="static-panel">static map</div>;

beforeEach(() => {
  observers = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ContactTimezoneLazy', () => {
  it('shows the server-rendered panel and loads nothing until the panel nears the viewport', () => {
    render(<ContactTimezoneLazy>{STATIC_PANEL}</ContactTimezoneLazy>);

    expect(screen.getByTestId('static-panel')).toBeTruthy();
    expect(screen.queryByTestId('contact-timezone')).toBeNull();
  });

  it('starts loading ahead of the viewport, not at its edge', () => {
    render(<ContactTimezoneLazy>{STATIC_PANEL}</ContactTimezoneLazy>);

    expect(loader().options?.rootMargin).toMatch(/^\d+px$/);
    expect(Number.parseInt(loader().options?.rootMargin ?? '0', 10)).toBeGreaterThan(0);
  });

  it('swaps in the live panel once it nears the viewport and stops observing', async () => {
    render(<ContactTimezoneLazy>{STATIC_PANEL}</ContactTimezoneLazy>);

    await act(async () => loader().callback([{ isIntersecting: true }]));

    expect(await screen.findByTestId('contact-timezone')).toBeTruthy();
    expect(screen.queryByTestId('static-panel')).toBeNull();
    expect(loader().disconnected).toBe(true);
  });

  it('keeps the static panel while the live one has not loaded', async () => {
    render(<ContactTimezoneLazy>{STATIC_PANEL}</ContactTimezoneLazy>);

    await act(async () => loader().callback([{ isIntersecting: false }]));

    expect(screen.getByTestId('static-panel')).toBeTruthy();
  });

  it('loads at once when the browser has no IntersectionObserver', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);

    render(<ContactTimezoneLazy>{STATIC_PANEL}</ContactTimezoneLazy>);

    expect(await screen.findByTestId('contact-timezone')).toBeTruthy();
  });
});
