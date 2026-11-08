import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOTION_BOOTSTRAP_SCRIPT } from '@/lib/motion-bootstrap';

function runBootstrap() {
  new Function(MOTION_BOOTSTRAP_SCRIPT)();
}

describe('body motion bootstrap', () => {
  let matchMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    delete document.body.dataset.motion;
    matchMedia = vi.fn().mockReturnValue({ matches: true });
    Object.defineProperty(window, 'matchMedia', { writable: true, value: matchMedia });
  });

  afterEach(() => {
    localStorage.clear();
    delete document.body.dataset.motion;
  });

  it('paints a first visit with full motion even when the system asks for reduced motion', () => {
    runBootstrap();
    expect(document.body.dataset.motion).toBe('full');
    expect(
      matchMedia,
      'the operating system preference must not be consulted',
    ).not.toHaveBeenCalled();
  });

  it('paints a stored OFF as reduce', () => {
    localStorage.setItem('erik.motion', 'off');
    runBootstrap();
    expect(document.body.dataset.motion).toBe('reduce');
  });

  it('paints a stored ON as full', () => {
    localStorage.setItem('erik.motion', 'on');
    runBootstrap();
    expect(document.body.dataset.motion).toBe('full');
  });

  it('paints full motion when storage throws', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    try {
      runBootstrap();
      expect(document.body.dataset.motion).toBe('full');
    } finally {
      getItem.mockRestore();
    }
  });
});
