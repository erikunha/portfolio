import { afterEach, describe, expect, it, vi } from 'vitest';
import { installMatchMedia } from '@/__tests__/helpers/match-media';
import { isMobileViewport, MOBILE_QUERY, watchMobileViewport } from '@/lib/media-queries';

const OTHER_QUERY = '(prefers-reduced-motion: reduce)';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('installMatchMedia', () => {
  it('fires only the listeners registered for the emitted query', () => {
    const stub = installMatchMedia();
    const mobile = vi.fn();
    const other = vi.fn();
    window.matchMedia(MOBILE_QUERY).addEventListener('change', mobile);
    window.matchMedia(OTHER_QUERY).addEventListener('change', other);

    stub.emit(MOBILE_QUERY, true);

    expect(mobile).toHaveBeenCalledTimes(1);
    expect(mobile.mock.calls[0]?.[0]).toMatchObject({ matches: true, media: MOBILE_QUERY });
    expect(other).not.toHaveBeenCalled();
  });

  it('stops delivering after removeEventListener and reports the count', () => {
    const stub = installMatchMedia();
    const cb = vi.fn();
    const list = window.matchMedia(MOBILE_QUERY);
    list.addEventListener('change', cb);
    expect(stub.listenerCount(MOBILE_QUERY)).toBe(1);
    list.removeEventListener('change', cb);
    expect(stub.listenerCount(MOBILE_QUERY)).toBe(0);

    stub.emit(MOBILE_QUERY, true);

    expect(cb).not.toHaveBeenCalled();
  });

  it('updates matches for every list of that query after emit', () => {
    const stub = installMatchMedia({ [MOBILE_QUERY]: false });
    const list = window.matchMedia(MOBILE_QUERY);
    expect(list.matches).toBe(false);
    stub.emit(MOBILE_QUERY, true);
    expect(list.matches).toBe(true);
    expect(window.matchMedia(MOBILE_QUERY).matches).toBe(true);
  });
});

describe('mobile viewport helpers', () => {
  it('isMobileViewport reads the mobile query synchronously', () => {
    installMatchMedia({ [MOBILE_QUERY]: true });
    expect(isMobileViewport()).toBe(true);
  });

  it('watchMobileViewport calls back on change and stops after cleanup', () => {
    const stub = installMatchMedia(false);
    const onChange = vi.fn();
    const stop = watchMobileViewport(onChange);
    expect(stub.listenerCount(MOBILE_QUERY)).toBe(1);

    stub.emit(MOBILE_QUERY, true);
    expect(onChange).toHaveBeenLastCalledWith(true);
    stub.emit(MOBILE_QUERY, false);
    expect(onChange).toHaveBeenLastCalledWith(false);

    stop();
    expect(stub.listenerCount(MOBILE_QUERY)).toBe(0);
    stub.emit(MOBILE_QUERY, true);
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
