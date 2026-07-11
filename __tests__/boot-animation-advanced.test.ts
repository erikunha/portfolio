import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type BootClasses,
  type BootCtrl,
  buildDesktopOnFirstLoop,
  runBoot,
} from '@/lib/boot-animation';

const cls: BootClasses = {
  bootOk: 'ok',
  bootEnc: 'enc',
  bootWelcome: 'welcome',
  bootPrompt: 'prompt',
  bootCmd: 'cmd',
  bootMatrixPrefix: 'prefix',
  bootMatrixOut: 'out',
  bootCursor: 'cursor',
  bootLine: 'line',
  shake: 'shake',
  shake2: 'shake2',
};

const fastOpts = {
  lineMs: 5,
  lineJitter: 0,
  cmdMs: 5,
  cmdJitter: 0,
  typeMs: 5,
  holdMs: 10,
  backMs: 5,
  interMs: 5,
  startMs: 5,
};

describe('runBoot — cancel path', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('cancel() clears pending timers so no further DOM mutations occur', async () => {
    const container = document.createElement('div');
    const ctrl = runBoot(container, [['boot line']], ['Wake up, Neo...'], cls, fastOpts);

    await vi.advanceTimersByTimeAsync(20);
    const countAfterStart = container.childElementCount;

    ctrl.cancel();

    await vi.advanceTimersByTimeAsync(5000);
    expect(container.childElementCount).toBe(countAfterStart);
  });

  it('cancel() sets cancelled=true so revealLines / typeCmd bail immediately', async () => {
    const container = document.createElement('div');
    const ctrl = runBoot(container, [['line']], ['Neo...'], cls, {
      ...fastOpts,
      startMs: 50,
    });

    ctrl.cancel();
    await vi.advanceTimersByTimeAsync(5000);
    expect(container.childElementCount).toBe(0);
  });
});

describe('runBoot — pauseDialog / resumeDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('pauseDialog and resumeDialog are callable without error during animation', async () => {
    const container = document.createElement('div');
    const ctrl = runBoot(container, [['line']], ['Hello'], cls, fastOpts);

    await vi.advanceTimersByTimeAsync(600);

    expect(() => ctrl.pauseDialog()).not.toThrow();

    await vi.advanceTimersByTimeAsync(1000);

    expect(() => ctrl.resumeDialog()).not.toThrow();

    await vi.advanceTimersByTimeAsync(500);

    ctrl.cancel();
  });

  it('resumeDialog while not paused is a no-op (dialogResumeFn is null)', async () => {
    const container = document.createElement('div');
    const ctrl = runBoot(container, [['line']], ['Hello'], cls, fastOpts);

    await vi.advanceTimersByTimeAsync(100);

    expect(() => ctrl.resumeDialog()).not.toThrow();

    ctrl.cancel();
  });
});

describe('runBoot — onFirstLoop callback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fires onFirstLoop exactly once after the dialog cycles back to phraseIdx 0', async () => {
    const onFirstLoop = vi.fn();
    const container = document.createElement('div');
    const ctrl = runBoot(container, [['line']], ['Hi', 'There'], cls, {
      ...fastOpts,
      onFirstLoop,
    });

    await vi.advanceTimersByTimeAsync(2000);

    expect(onFirstLoop).toHaveBeenCalledTimes(1);
    ctrl.cancel();
  });
});

describe('buildDesktopOnFirstLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.documentElement.classList.remove('sysfail-on', 'shake', 'shake2');
  });

  it('dispatches sysfail:start and hero:sysfail:show events', () => {
    const el = document.createElement('div');
    const section = document.createElement('section');
    section.appendChild(el);
    document.body.appendChild(section);

    vi.spyOn(section, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 200,
      left: 0,
      right: 800,
      width: 800,
      height: 100,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);

    const ctrlRef: { current: BootCtrl | null } = {
      current: {
        cancel: vi.fn(),
        pauseDialog: vi.fn(),
        resumeDialog: vi.fn(),
      },
    };

    const sysfailStartSpy = vi.fn();
    const sysfailShowSpy = vi.fn();
    window.addEventListener('sysfail:start', sysfailStartSpy);
    window.addEventListener('hero:sysfail:show', sysfailShowSpy);

    const fn = buildDesktopOnFirstLoop(el, ctrlRef, { shake: 'shake', shake2: 'shake2' });
    fn();

    expect(sysfailStartSpy).toHaveBeenCalledTimes(1);
    expect(sysfailShowSpy).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains('sysfail-on')).toBe(true);
    expect(ctrlRef.current?.pauseDialog).toHaveBeenCalledTimes(1);

    window.removeEventListener('sysfail:start', sysfailStartSpy);
    window.removeEventListener('hero:sysfail:show', sysfailShowSpy);
    document.body.removeChild(section);
  });

  it('adds shake class, replaces with shake2, then removes both', async () => {
    const el = document.createElement('div');
    const section = document.createElement('section');
    section.appendChild(el);
    document.body.appendChild(section);

    vi.spyOn(section, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 200,
      left: 0,
      right: 800,
      width: 800,
      height: 100,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);

    const ctrlRef: { current: BootCtrl | null } = {
      current: { cancel: vi.fn(), pauseDialog: vi.fn(), resumeDialog: vi.fn() },
    };

    const fn = buildDesktopOnFirstLoop(el, ctrlRef, { shake: 'shake', shake2: 'shake2' });
    fn();

    expect(section.classList.contains('shake')).toBe(true);
    expect(section.classList.contains('shake2')).toBe(false);

    await vi.advanceTimersByTimeAsync(40);
    expect(section.classList.contains('shake')).toBe(false);
    expect(section.classList.contains('shake2')).toBe(true);

    await vi.advanceTimersByTimeAsync(40);
    expect(section.classList.contains('shake')).toBe(false);
    expect(section.classList.contains('shake2')).toBe(false);

    document.body.removeChild(section);
  });

  it('skips if hero section is off-screen (bottom < 0)', () => {
    const el = document.createElement('div');
    const section = document.createElement('section');
    section.appendChild(el);
    document.body.appendChild(section);

    vi.spyOn(section, 'getBoundingClientRect').mockReturnValue({
      top: -200,
      bottom: -100,
      left: 0,
      right: 800,
      width: 800,
      height: 100,
      x: 0,
      y: -200,
      toJSON: () => ({}),
    } as DOMRect);

    const ctrlRef: { current: BootCtrl | null } = {
      current: { cancel: vi.fn(), pauseDialog: vi.fn(), resumeDialog: vi.fn() },
    };

    const fn = buildDesktopOnFirstLoop(el, ctrlRef, { shake: 'shake', shake2: 'shake2' });
    fn();

    expect(ctrlRef.current?.pauseDialog).not.toHaveBeenCalled();

    document.body.removeChild(section);
  });

  it('fires hero:sysfail:hide and sysfail:end after the hold period', async () => {
    const el = document.createElement('div');
    const section = document.createElement('section');
    section.appendChild(el);
    document.body.appendChild(section);

    vi.spyOn(section, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 200,
      left: 0,
      right: 800,
      width: 800,
      height: 100,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);

    const ctrlRef: { current: BootCtrl | null } = {
      current: { cancel: vi.fn(), pauseDialog: vi.fn(), resumeDialog: vi.fn() },
    };

    const hideSpy = vi.fn();
    const endSpy = vi.fn();
    window.addEventListener('hero:sysfail:hide', hideSpy);
    window.addEventListener('sysfail:end', endSpy);

    const fn = buildDesktopOnFirstLoop(el, ctrlRef, { shake: 'shake', shake2: 'shake2' });
    fn();

    await vi.advanceTimersByTimeAsync(4999);
    expect(hideSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(hideSpy).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains('sysfail-on')).toBe(false);

    await vi.advanceTimersByTimeAsync(300);
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(ctrlRef.current?.resumeDialog).toHaveBeenCalledTimes(1);

    window.removeEventListener('hero:sysfail:hide', hideSpy);
    window.removeEventListener('sysfail:end', endSpy);
    document.body.removeChild(section);
  });
});
