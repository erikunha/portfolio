import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaglineTyper } from './TaglineTyper.client';

const PHRASES = ['Senior Full-Stack Engineer', 'AI Engineering na prática'];

function mockMotion(prefersReduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: prefersReduced,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

describe('TaglineTyper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders the first phrase before any timer runs, so the line is never blank on paint', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(<TaglineTyper phrases={PHRASES} />);
    const visible = container.querySelector('span[aria-hidden="true"]:not(.sr-only)');

    expect(
      visible?.textContent,
      'the visible span must contain the first phrase before effects run',
    ).toBe(PHRASES[0]);
  });

  it('types by mutating textContent rather than re-rendering per character', () => {
    mockMotion(false);
    const { container } = render(<TaglineTyper phrases={PHRASES} />);
    const visible = container.querySelector('[aria-hidden="true"]');
    expect(visible).not.toBeNull();

    vi.advanceTimersByTime(210);
    expect(visible?.textContent).toBe('Seni');

    vi.advanceTimersByTime(140);
    expect(visible?.textContent).toBe('Senior');
  });

  it('holds the full phrase still when the visitor prefers reduced motion', () => {
    mockMotion(true);
    const { container } = render(<TaglineTyper phrases={PHRASES} />);
    const visible = container.querySelector('[aria-hidden="true"]');

    vi.advanceTimersByTime(5_000);
    expect(visible?.textContent).toBe('Senior Full-Stack Engineer');
  });

  it('keeps one stable phrase for screen readers instead of announcing every keystroke', () => {
    mockMotion(false);
    const { container } = render(<TaglineTyper phrases={PHRASES} />);
    const announced = container.querySelector('.sr-only');

    vi.advanceTimersByTime(2_000);
    expect(announced?.textContent).toBe('Senior Full-Stack Engineer');
  });

  it('announces each completed phrase through a polite live region', () => {
    mockMotion(false);
    const { container } = render(<TaglineTyper phrases={PHRASES} />);
    const live = container.querySelector('[role="status"]');
    expect(live?.getAttribute('aria-live')).toBe('polite');

    vi.advanceTimersByTime(7_000);
    expect(live?.textContent).toBe('AI Engineering na prática');
  });

  it('stops its timers on unmount', () => {
    mockMotion(false);
    const { unmount, container } = render(<TaglineTyper phrases={PHRASES} />);
    const visible = container.querySelector('[aria-hidden="true"]');
    const before = visible?.textContent;
    unmount();
    vi.advanceTimersByTime(1_000);
    expect(visible?.textContent).toBe(before);
  });
});
