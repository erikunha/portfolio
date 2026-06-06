// __tests__/boot-animation-advanced.test.ts
// Behavioral tests for advanced boot-animation paths:
//   - runBoot cancel path: stops DOM mutation after cancel()
//   - pauseDialog / resumeDialog: pauses and resumes typing tick
//   - onFirstLoop callback fires after first complete dialog cycle
//   - buildDesktopOnFirstLoop: fires sysfail events, pauses dialog, schedules resume

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

    // Let a small amount of time pass for the initial boot to begin
    await vi.advanceTimersByTimeAsync(20);
    const countAfterStart = container.childElementCount;

    // Cancel — no more timers should fire
    ctrl.cancel();

    // Advance a lot more time — nothing should append
    await vi.advanceTimersByTimeAsync(5000);
    expect(container.childElementCount).toBe(countAfterStart);
  });

  it('cancel() sets cancelled=true so revealLines / typeCmd bail immediately', async () => {
    const container = document.createElement('div');
    const ctrl = runBoot(container, [['line']], ['Neo...'], cls, {
      ...fastOpts,
      startMs: 50, // delay start so we can cancel before first line
    });

    // Cancel before startMs elapses — nothing should render at all
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

    // Advance far enough for the animation to fully proceed
    await vi.advanceTimersByTimeAsync(600);

    // pauseDialog sets the flag; should not throw
    expect(() => ctrl.pauseDialog()).not.toThrow();

    // Advance while paused — no new timers should fire (dialogPaused=true)
    await vi.advanceTimersByTimeAsync(1000);

    // resumeDialog clears the flag and calls dialogResumeFn if set
    expect(() => ctrl.resumeDialog()).not.toThrow();

    // Continue advancing — animation resumes
    await vi.advanceTimersByTimeAsync(500);

    ctrl.cancel();
  });

  it('resumeDialog while not paused is a no-op (dialogResumeFn is null)', async () => {
    const container = document.createElement('div');
    const ctrl = runBoot(container, [['line']], ['Hello'], cls, fastOpts);

    await vi.advanceTimersByTimeAsync(100);

    // Resume without prior pause — should not throw, dialogResumeFn is null
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

    // Drive enough time for both phrases to type/hold/back and cycle back to idx 0
    // Each phrase: type (2-5 chars * 5ms) + hold (10ms) + back (same * 5ms) + inter (5ms)
    // With 2 phrases and tiny times, 2000ms should be plenty
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

    // Mock getBoundingClientRect so section is "in viewport"
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

    // Initially shake is added
    expect(section.classList.contains('shake')).toBe(true);
    expect(section.classList.contains('shake2')).toBe(false);

    // After FRAME_1_MS (40ms): replace with shake2
    await vi.advanceTimersByTimeAsync(40);
    expect(section.classList.contains('shake')).toBe(false);
    expect(section.classList.contains('shake2')).toBe(true);

    // After FRAME_2_MS (80ms): both removed
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
      bottom: -100, // below 0 = off-screen above
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

    // Off-screen: nothing should happen (early return after getBoundingClientRect check)
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

    // Before the hold period (5000ms), hide event should NOT have fired
    await vi.advanceTimersByTimeAsync(4999);
    expect(hideSpy).not.toHaveBeenCalled();

    // After 5000ms: hero:sysfail:hide fires, sysfail-on removed
    await vi.advanceTimersByTimeAsync(1);
    expect(hideSpy).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains('sysfail-on')).toBe(false);

    // After additional fade tail (300ms): sysfail:end fires, resumeDialog called
    await vi.advanceTimersByTimeAsync(300);
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(ctrlRef.current?.resumeDialog).toHaveBeenCalledTimes(1);

    window.removeEventListener('hero:sysfail:hide', hideSpy);
    window.removeEventListener('sysfail:end', endSpy);
    document.body.removeChild(section);
  });
});
