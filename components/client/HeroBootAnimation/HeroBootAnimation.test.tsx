import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountClient } from '@/__tests__/helpers/render';

vi.mock('@/lib/motion', () => ({
  readMotion: () => true,
}));

const bootDesktopClass = 'hero-boot-desktop';
const bootCmdClass = 'hero-boot-cmd';

describe('mobile boot container: line-count → height invariant', () => {
  it('MOBILE_LINE_SPECS + cmd + blank + dialog = 8 lines; fits height: 165px', async () => {
    const { MOBILE_LINE_SPECS } = await import('@/lib/boot-animation');
    const extraLines = 3;
    const totalLines = MOBILE_LINE_SPECS.length + extraLines;
    const containerHeightPx = 165;
    const fontSizePx = 12;
    const lineHeight = 1.65;
    expect(totalLines).toBe(8);
    expect(Math.ceil(totalLines * fontSizePx * lineHeight)).toBeLessThanOrEqual(containerHeightPx);
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
