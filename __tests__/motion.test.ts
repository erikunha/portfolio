// __tests__/motion.test.ts
// Unit tests for lib/motion.ts — single source of truth for body.dataset.motion.
import { describe, it, expect, beforeEach, vi } from 'vitest';

// jsdom environment is set in vitest.config.ts
import { readMotion, applyMotion } from '@/lib/motion';

describe('readMotion', () => {
  beforeEach(() => {
    localStorage.clear();
    // Default: no media query match (motion allowed)
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
    // matchMedia returns matches=false → reduced-motion not requested → motion on
    expect(readMotion()).toBe(true);
  });

  it('falls back to matchMedia prefers-reduced-motion: reduce', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    expect(readMotion()).toBe(false);
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
