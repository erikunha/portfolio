import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type BootTiming, typeThenLoop } from './boot-timing';

const TIMING: BootTiming = {
  cmdMs: 10,
  cmdJitter: 4,
  typeMs: 20,
  holdMs: 100,
  backMs: 5,
  interMs: 30,
};
const HANDOFF_MS = 50;

function setup(overrides: { startPaused?: () => boolean; dialog?: string[] } = {}) {
  const log: string[] = [];
  const ctrl = typeThenLoop({
    command: 'ab',
    dialog: overrides.dialog ?? ['xy'],
    timing: TIMING,
    handoffMs: HANDOFF_MS,
    onCommandText: (t) => log.push(`cmd:${t}`),
    onCommandDone: () => log.push('cmd-done'),
    onDialogStart: () => log.push('dialog-start'),
    onDialogText: (t) => log.push(`out:${t}`),
    startPaused: overrides.startPaused,
  });
  return { log, ctrl };
}

describe('typeThenLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('types the command with cmdMs plus jitter between characters', () => {
    const { log } = setup();
    expect(log).toEqual(['cmd:a']);
    vi.advanceTimersByTime(11);
    expect(log).toEqual(['cmd:a']);
    vi.advanceTimersByTime(1);
    expect(log).toEqual(['cmd:a', 'cmd:ab', 'cmd-done']);
  });

  it('starts the dialog exactly handoffMs after the command finishes', () => {
    const { log } = setup();
    vi.advanceTimersByTime(12);
    vi.advanceTimersByTime(HANDOFF_MS - 1);
    expect(log).not.toContain('dialog-start');
    vi.advanceTimersByTime(1);
    expect(log.slice(-2)).toEqual(['dialog-start', 'out:x']);
  });

  it('loops the dialog on typeMs, holdMs, backMs and interMs', () => {
    const { log } = setup();
    vi.advanceTimersByTime(12 + HANDOFF_MS);
    vi.advanceTimersByTime(20);
    expect(log.at(-1)).toBe('out:xy');
    vi.advanceTimersByTime(100 + 5);
    expect(log.at(-1)).toBe('out:x');
    vi.advanceTimersByTime(5);
    expect(log.at(-1)).toBe('out:');
    vi.advanceTimersByTime(30 - 1);
    expect(log.at(-1)).toBe('out:');
    vi.advanceTimersByTime(1);
    expect(log.at(-1)).toBe('out:x');
  });

  it('cancel before the handoff prevents the dialog from ever starting', () => {
    const { log, ctrl } = setup();
    vi.advanceTimersByTime(12);
    ctrl.cancel();
    vi.advanceTimersByTime(10_000);
    expect(log).toEqual(['cmd:a', 'cmd:ab', 'cmd-done']);
  });

  it('cancel while typing the command stops all later steps', () => {
    const { log, ctrl } = setup();
    ctrl.cancel();
    vi.advanceTimersByTime(10_000);
    expect(log).toEqual(['cmd:a']);
  });

  it('cancel during the dialog stops the loop', () => {
    const { log, ctrl } = setup();
    vi.advanceTimersByTime(12 + HANDOFF_MS);
    ctrl.cancel();
    const seen = log.length;
    vi.advanceTimersByTime(10_000);
    expect(log).toHaveLength(seen);
  });

  it('pause holds the dialog and resume continues it', () => {
    const { log, ctrl } = setup();
    vi.advanceTimersByTime(12 + HANDOFF_MS);
    ctrl.pause();
    vi.advanceTimersByTime(10_000);
    expect(log.at(-1)).toBe('out:x');
    ctrl.resume();
    expect(log.at(-1)).toBe('out:xy');
  });

  it('a dialog started while paused types nothing until resumed', () => {
    const { log, ctrl } = setup({ startPaused: () => true });
    vi.advanceTimersByTime(12 + HANDOFF_MS);
    vi.advanceTimersByTime(10_000);
    expect(log.at(-1)).toBe('dialog-start');
    ctrl.resume();
    expect(log.at(-1)).toBe('out:x');
  });
});
