import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMatchMedia } from '@/__tests__/helpers/match-media';
import { mountClient } from '@/__tests__/helpers/render';
import { heroClientContent } from '@/content/hero-client';
import { SITE_LOCALE } from '@/content/site-locale';
import { MOBILE_QUERY } from '@/lib/media-queries';

vi.mock('@/lib/motion', () => ({
  readMotion: vi.fn(() => true),
}));

const bootCopy = heroClientContent[SITE_LOCALE.en];
const bootDesktopClass = 'hero-boot-desktop';
const bootCmdClass = 'hero-boot-cmd';

describe('mobile boot container: line-count → height invariant', () => {
  it('renders exactly three boot lines and no blank filler line', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { HeroBootAnimation } = await import('./HeroBootAnimation');
    const html = renderToStaticMarkup(<HeroBootAnimation variant="mobile" copy={bootCopy} />);
    const host = document.createElement('div');
    host.innerHTML = html;
    const lines = [...host.querySelectorAll('[data-testid="boot-line"]')];
    expect(
      lines,
      'the mobile boot log is the sequence, the command and the matrix output',
    ).toHaveLength(3);
    expect(
      lines.some((line) => (line.textContent ?? '').trim() === ''),
      'a blank filler line is the dead space the r106 mobile hero does not have',
    ).toBe(false);
  });
});

const testCls = {
  bootLine: 'bootLine',
  bootOk: 'bootOk',
  bootEnc: 'bootEnc',
  bootWelcome: 'bootWelcome',
  bootPrompt: 'bootPrompt',
  bootCmd: 'bootCmd',
  bootMatrixPrefix: 'bootMatrixPrefix',
  bootMatrixOut: 'bootMatrixOut',
  bootCursor: 'bootCursor',
  shake: 'shake',
  shake2: 'shake2',
} as const;

describe('boot-animation: textContent-mutation invariant', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('runBoot drives the typing loop by mutating textContent on DOM nodes', async () => {
    const { runBoot } = await import('@/lib/boot-animation');
    const container = document.createElement('div');

    const ctrl = runBoot(container, [['line one']], ['Wake up, Neo...'], testCls, {
      lineMs: 10,
      lineJitter: 0,
      cmdMs: 5,
      cmdJitter: 0,
      typeMs: 5,
      holdMs: 50,
      backMs: 5,
      interMs: 20,
      startMs: 5,
    });

    await vi.advanceTimersByTimeAsync(2000);

    const out = container.querySelector('.bootMatrixOut');
    expect(out).not.toBeNull();
    expect((out?.textContent ?? '').length).toBeGreaterThan(0);
    const cmd = container.querySelector('.bootCmd');
    expect(cmd?.textContent).toBe('run bio.exe --verbose');

    ctrl.cancel();
  });

  it('HeroBootAnimation types into a useRef-held node imperatively, not via React children', async () => {
    const React = await import('react');
    const { HeroBootAnimation } = await import('./HeroBootAnimation');

    installMatchMedia(false);

    const { container, unmount } = await mountClient(
      React.createElement(HeroBootAnimation, { variant: 'desktop', copy: bootCopy }),
    );

    const mount = container.querySelector(`.${bootDesktopClass}`);
    expect(mount).not.toBeNull();
    expect(mount?.getAttribute('aria-hidden')).toBe('true');
    expect(mount?.childElementCount).toBe(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });

    expect(mount?.childElementCount ?? 0).toBeGreaterThan(0);
    const cmd = mount?.querySelector(`.${bootCmdClass}`);
    expect(cmd?.textContent).toBe('run bio.exe --verbose');

    expect(cmd?.childElementCount).toBe(0);
    expect(cmd?.childNodes.length).toBe(1);
    expect(cmd?.childNodes[0]?.nodeType).toBe(3);

    unmount();
  });
});

describe('decorative boot output', () => {
  it.each(['desktop', 'mobile'] as const)(
    'hides the %s boot output from assistive technology',
    async (variant) => {
      const { renderToStaticMarkup } = await import('react-dom/server');
      const { HeroBootAnimation } = await import('./HeroBootAnimation');
      const html = renderToStaticMarkup(<HeroBootAnimation variant={variant} copy={bootCopy} />);
      const host = document.createElement('div');
      host.innerHTML = html;
      expect(host.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    },
  );

  it('types the mobile command and the matrix output into the rendered lines', async () => {
    vi.useFakeTimers();
    installMatchMedia(true);
    const { HeroBootAnimation } = await import('./HeroBootAnimation');
    const mounted = await mountClient(<HeroBootAnimation variant="mobile" copy={bootCopy} />);
    const host = mounted.container.querySelector('.hero-boot-mobile');
    expect(host).not.toBeNull();
    expect(host?.querySelectorAll('[data-testid="boot-line"]')).toHaveLength(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });

    const cmd = host?.querySelector('.hero-boot-cmd');
    const out = host?.querySelector('.hero-boot-matrix-out');
    expect(cmd?.textContent, 'the mobile boot types the full command').toBe(
      'run bio.exe --verbose',
    );
    expect(
      (out?.textContent ?? '').length,
      'the mobile boot types the matrix output',
    ).toBeGreaterThan(0);

    mounted.unmount();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps reduced-motion output static without starting animation timers', async () => {
    const { readMotion } = await import('@/lib/motion');
    vi.mocked(readMotion).mockReturnValue(false);
    installMatchMedia(false);
    vi.useFakeTimers();
    const { HeroBootAnimation } = await import('./HeroBootAnimation');
    const mounted = await mountClient(<HeroBootAnimation variant="desktop" copy={bootCopy} />);
    const before = mounted.container.textContent;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(mounted.container.textContent).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
    mounted.unmount();
    vi.useRealTimers();
    vi.mocked(readMotion).mockReturnValue(true);
    vi.unstubAllGlobals();
  });
});

describe('runMobileBoot: timers', () => {
  const timing = {
    cmdMs: 5,
    cmdJitter: 0,
    typeMs: 5,
    holdMs: 20,
    backMs: 5,
    interMs: 10,
  };

  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps one pending timer however many phrases it cycles through', async () => {
    const { runMobileBoot } = await import('./mobile-boot');
    const cmdEl = document.createElement('span');
    const outEl = document.createElement('span');
    const boot = runMobileBoot(cmdEl, outEl, 'run', ['ab', 'cd', 'ef'], timing);
    for (let step = 0; step < 400; step++) {
      await vi.advanceTimersByTimeAsync(5);
      expect(vi.getTimerCount()).toBeLessThanOrEqual(1);
    }
    expect(cmdEl.textContent).toBe('run');
    expect(outEl.textContent).not.toBe('');
    boot.cancel();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops typing the command when cancelled mid-way', async () => {
    const { runMobileBoot } = await import('./mobile-boot');
    const cmdEl = document.createElement('span');
    const outEl = document.createElement('span');
    const boot = runMobileBoot(cmdEl, outEl, 'run', ['ab'], timing);
    boot.cancel();
    await vi.advanceTimersByTimeAsync(1000);
    expect(cmdEl.textContent).toBe('r');
    expect(outEl.textContent).toBe('');
  });
});

describe('hero boot follows the motion switch and the viewport', () => {
  type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;
  let reportIntersection: ObserverCallback = () => undefined;

  class ObserverStub {
    constructor(callback: ObserverCallback) {
      reportIntersection = callback;
    }
    observe = vi.fn();
    disconnect = vi.fn();
  }

  function stubViewport(isMobile: boolean) {
    return installMatchMedia({ [MOBILE_QUERY]: isMobile });
  }

  function announceMotion(on: boolean) {
    window.dispatchEvent(new CustomEvent('motionchange', { detail: { on } }));
  }

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', ObserverStub);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([
    ['desktop', false, '.hero-boot-desktop'],
    ['mobile', true, '.hero-boot-mobile'],
  ] as const)(
    'stops the %s typing loop and shows the static boot when motion is switched off',
    async (variant, isMobile, hostSelector) => {
      const { readMotion } = await import('@/lib/motion');
      vi.mocked(readMotion).mockReturnValue(true);
      stubViewport(isMobile);
      const { HeroBootAnimation } = await import('./HeroBootAnimation');
      const mounted = await mountClient(<HeroBootAnimation variant={variant} copy={bootCopy} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(vi.getTimerCount(), 'the loop is running before the switch').toBeGreaterThan(0);

      vi.mocked(readMotion).mockReturnValue(false);
      await act(async () => {
        announceMotion(false);
        await vi.advanceTimersByTimeAsync(0);
      });

      const host = mounted.container.querySelector(hostSelector);
      expect(vi.getTimerCount(), 'switching motion off must stop every boot timer').toBe(0);
      expect(host?.textContent, 'the static boot shows the full command').toContain(
        'run bio.exe --verbose',
      );
      const frozen = host?.textContent;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(host?.textContent).toBe(frozen);
      mounted.unmount();
    },
  );

  it.each([
    ['desktop', false, '.hero-boot-matrix-out'],
    ['mobile', true, '.hero-boot-matrix-out'],
  ] as const)(
    'pauses the %s dialog while the hero is off screen and resumes it in view',
    async (variant, isMobile, outSelector) => {
      const { readMotion } = await import('@/lib/motion');
      vi.mocked(readMotion).mockReturnValue(true);
      stubViewport(isMobile);
      const { HeroBootAnimation } = await import('./HeroBootAnimation');
      const mounted = await mountClient(<HeroBootAnimation variant={variant} copy={bootCopy} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });
      const out = mounted.container.querySelector(outSelector);

      await act(async () => {
        reportIntersection([{ isIntersecting: false }]);
        await vi.advanceTimersByTimeAsync(2500);
      });
      const frozen = out?.textContent;
      expect(vi.getTimerCount(), 'an off-screen hero keeps no typing timer').toBe(0);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(out?.textContent).toBe(frozen);

      await act(async () => {
        reportIntersection([{ isIntersecting: true }]);
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(vi.getTimerCount(), 'back in view the dialog types again').toBeGreaterThan(0);
      mounted.unmount();
    },
  );

  it('starts the desktop boot when the viewport widens past the mobile breakpoint', async () => {
    const { readMotion } = await import('@/lib/motion');
    vi.mocked(readMotion).mockReturnValue(true);
    const media = stubViewport(true);
    const { HeroBootAnimation } = await import('./HeroBootAnimation');
    const mounted = await mountClient(<HeroBootAnimation variant="desktop" copy={bootCopy} />);
    expect(vi.getTimerCount(), 'a mobile viewport leaves the desktop boot idle').toBe(0);
    expect(media.listenerCount(MOBILE_QUERY)).toBe(1);

    await act(async () => {
      media.emit(MOBILE_QUERY, false);
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(vi.getTimerCount(), 'widening the viewport starts the desktop boot').toBeGreaterThan(0);

    mounted.unmount();
    expect(media.listenerCount(MOBILE_QUERY)).toBe(0);
  });

  it('stops the mobile boot when the viewport widens and restarts it when it narrows', async () => {
    const { readMotion } = await import('@/lib/motion');
    vi.mocked(readMotion).mockReturnValue(true);
    const media = stubViewport(true);
    const { HeroBootAnimation } = await import('./HeroBootAnimation');
    const mounted = await mountClient(<HeroBootAnimation variant="mobile" copy={bootCopy} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    await act(async () => {
      media.emit(MOBILE_QUERY, false);
    });
    expect(vi.getTimerCount(), 'leaving the mobile viewport cancels the typing').toBe(0);

    await act(async () => {
      media.emit(MOBILE_QUERY, true);
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(vi.getTimerCount(), 'returning to mobile types again').toBeGreaterThan(0);

    mounted.unmount();
    expect(media.listenerCount(MOBILE_QUERY)).toBe(0);
  });
});
