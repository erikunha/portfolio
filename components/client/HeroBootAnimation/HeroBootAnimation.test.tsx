import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountClient } from '@/__tests__/helpers/render';

vi.mock('@/lib/motion', () => ({
  readMotion: vi.fn(() => true),
}));

const bootDesktopClass = 'hero-boot-desktop';
const bootCmdClass = 'hero-boot-cmd';

describe('mobile boot container: line-count → height invariant', () => {
  it('renders exactly three boot lines and no blank filler line', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { HeroBootAnimation } = await import('./HeroBootAnimation');
    const html = renderToStaticMarkup(<HeroBootAnimation variant="mobile" />);
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

    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );

    const { container, unmount } = await mountClient(
      React.createElement(HeroBootAnimation, { variant: 'desktop' }),
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
      const html = renderToStaticMarkup(<HeroBootAnimation variant={variant} />);
      const host = document.createElement('div');
      host.innerHTML = html;
      expect(host.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    },
  );

  it('types the mobile command and the matrix output into the rendered lines', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const { HeroBootAnimation } = await import('./HeroBootAnimation');
    const mounted = await mountClient(<HeroBootAnimation variant="mobile" />);
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
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.useFakeTimers();
    const { HeroBootAnimation } = await import('./HeroBootAnimation');
    const mounted = await mountClient(<HeroBootAnimation variant="desktop" />);
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
