import { act, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMatchMedia } from '@/__tests__/helpers/match-media';
import { TaglineTyper } from './TaglineTyper.client';

const PHRASES = ['Senior Software Engineer, AI Engineer', 'AI Engineering na prática'];

function setMotion(on: boolean) {
  localStorage.setItem('erik.motion', on ? 'on' : 'off');
  installMatchMedia(true);
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
    setMotion(true);
    const { container } = render(<TaglineTyper phrases={PHRASES} />);
    const visible = container.querySelector('[aria-hidden="true"]');
    expect(visible).not.toBeNull();

    vi.advanceTimersByTime(210);
    expect(visible?.textContent).toBe('Seni');

    vi.advanceTimersByTime(140);
    expect(visible?.textContent).toBe('Senior');
  });

  it('stops on the first phrase when MOTION turns off and types again when it turns on', () => {
    setMotion(true);
    const { container } = render(<TaglineTyper phrases={PHRASES} />);
    const visible = container.querySelector('[aria-hidden="true"]');
    vi.advanceTimersByTime(210);
    expect(visible?.textContent).toBe('Seni');

    act(() => {
      window.dispatchEvent(new CustomEvent('motionchange', { detail: { on: false } }));
    });
    vi.advanceTimersByTime(2_000);
    expect(visible?.textContent).toBe(PHRASES[0]);

    act(() => {
      window.dispatchEvent(new CustomEvent('motionchange', { detail: { on: true } }));
    });
    vi.advanceTimersByTime(210);
    expect(visible?.textContent).not.toBe(PHRASES[0]);
  });

  it('holds the full phrase still when the MOTION switch is off, whatever the system asks', () => {
    setMotion(false);
    const { container } = render(<TaglineTyper phrases={PHRASES} />);
    const visible = container.querySelector('[aria-hidden="true"]');

    vi.advanceTimersByTime(5_000);
    expect(visible?.textContent).toBe('Senior Software Engineer, AI Engineer');
  });

  it('gives screen readers every phrase as static text, which never changes while typing', () => {
    setMotion(true);
    const { container } = render(<TaglineTyper phrases={PHRASES} />);
    const staticText = container.querySelector('.sr-only');
    const before = staticText?.textContent;
    expect(before).toContain(PHRASES[0]);
    expect(before).toContain(PHRASES[1]);

    vi.advanceTimersByTime(7_000);
    expect(staticText?.textContent).toBe(before);
  });

  it('holds no live region, so the typing cycle never announces itself every few seconds', () => {
    setMotion(true);
    const { container } = render(<TaglineTyper phrases={PHRASES} />);

    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('[aria-live]')).toBeNull();
  });

  it('stops its timers on unmount', () => {
    setMotion(true);
    const { unmount, container } = render(<TaglineTyper phrases={PHRASES} />);
    const visible = container.querySelector('[aria-hidden="true"]');
    const before = visible?.textContent;
    unmount();
    vi.advanceTimersByTime(1_000);
    expect(visible?.textContent).toBe(before);
  });
});
