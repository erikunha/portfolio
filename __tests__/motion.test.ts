import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyMotion, readMotion } from '@/lib/motion';

describe('readMotion', () => {
  let matchMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    matchMedia = vi.fn().mockReturnValue({ matches: true });
    Object.defineProperty(window, 'matchMedia', { writable: true, value: matchMedia });
  });

  it('returns true when localStorage is "on"', () => {
    localStorage.setItem('erik.motion', 'on');
    expect(readMotion()).toBe(true);
  });

  it('returns false when localStorage is "off"', () => {
    localStorage.setItem('erik.motion', 'off');
    expect(readMotion()).toBe(false);
  });

  it('starts ON for a first visit even when the operating system asks for reduced motion', () => {
    expect(
      readMotion(),
      'the owner decision is that the MOTION switch alone decides, so a first visit starts ON',
    ).toBe(true);
    expect(
      matchMedia,
      'the operating system preference must not be consulted',
    ).not.toHaveBeenCalled();
  });

  it('keeps a stored OFF over a no-preference system', () => {
    matchMedia.mockReturnValue({ matches: false });
    localStorage.setItem('erik.motion', 'off');
    expect(readMotion()).toBe(false);
  });

  it('starts ON when storage is unreadable', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    try {
      expect(readMotion()).toBe(true);
    } finally {
      getItem.mockRestore();
    }
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

  it('applies a default without storing it as the visitor choice', () => {
    applyMotion(true, false);
    expect(document.body.dataset.motion).toBe('full');
    expect(
      localStorage.getItem('erik.motion'),
      'a stored default would be read back as a visitor choice',
    ).toBeNull();
  });
});
