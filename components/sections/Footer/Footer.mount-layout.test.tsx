import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SITE_LOCALE } from '@/content/site-locale';
import { Footer } from './index';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Footer session counters at mount', () => {
  it('measures the scroll depth in the next frame, never inside the mount effect', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const scrollHeight = vi
      .spyOn(document.documentElement, 'scrollHeight', 'get')
      .mockReturnValue(2000);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(1000);
    vi.stubGlobal('scrollY', 500);

    const mounted = render(<Footer locale={SITE_LOCALE.en} />);

    expect(
      scrollHeight,
      'reading scrollHeight in the mount effect forces a synchronous layout of the freshly hydrated page',
    ).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);
    act(() => frames.splice(0)[0]?.(0));
    expect(scrollHeight).toHaveBeenCalledTimes(1);
    expect(mounted.container.querySelector('[data-sess="depth"]')?.textContent).toBe('50%');
    mounted.unmount();
  });
});
