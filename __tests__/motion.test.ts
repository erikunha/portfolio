import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyMotion, readMotion } from '@/lib/motion';

describe('readMotion', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  it('returns true when localStorage is "on"', () => {
    localStorage.setItem('erik.motion', 'on');
    expect(readMotion()).toBe(true);
  });

  it('returns false when localStorage is "off"', () => {
    localStorage.setItem('erik.motion', 'off');
    expect(readMotion()).toBe(false);
  });

  it('falls back to matchMedia when localStorage is empty', () => {
    expect(readMotion()).toBe(true);
  });

  it('falls back to matchMedia prefers-reduced-motion: reduce', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    expect(readMotion()).toBe(false);
  });

  it('returns true when window is undefined (SSR path)', () => {
    const originalWindow = globalThis.window;
    vi.stubGlobal('window', undefined);
    try {
      expect(readMotion()).toBe(true);
    } finally {
      vi.stubGlobal('window', originalWindow);
    }
  });
});

describe('applyMotion', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.dataset.motion = '';
  });

  it('sets body.dataset.motion to "full" and writes localStorage', () => {
    applyMotion(true);
    expect(document.body.dataset.motion).toBe('full');
    expect(localStorage.getItem('erik.motion')).toBe('on');
  });

  it('sets body.dataset.motion to "reduce" and writes localStorage', () => {
    applyMotion(false);
    expect(document.body.dataset.motion).toBe('reduce');
    expect(localStorage.getItem('erik.motion')).toBe('off');
  });
});
