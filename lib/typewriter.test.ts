import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type PhraseLoopTiming, runPhraseLoop, typeOut } from './typewriter';

const TIMING: PhraseLoopTiming = { typeMs: 10, holdMs: 100, backMs: 5, pauseMs: 50 };

describe('typeOut', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('writes the first character immediately and the rest one step apart', () => {
    const seen: string[] = [];
    typeOut('abc', {
      stepMs: 10,
      onText: (text) => seen.push(text),
      onDone: () => seen.push('done'),
    });
    expect(seen).toEqual(['a']);
    vi.advanceTimersByTime(10);
    expect(seen).toEqual(['a', 'ab']);
    vi.advanceTimersByTime(10);
    expect(seen).toEqual(['a', 'ab', 'abc', 'done']);
  });

  it('asks a step function for every delay', () => {
    const stepMs = vi.fn(() => 7);
    typeOut('abc', { stepMs, onText: () => undefined });
    vi.advanceTimersByTime(14);
    expect(stepMs).toHaveBeenCalledTimes(2);
  });

  it('stops writing and leaves no timer behind once cancelled', () => {
    const seen: string[] = [];
    const cancel = typeOut('abc', { stepMs: 10, onText: (text) => seen.push(text) });
    cancel();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(100);
    expect(seen).toEqual(['a']);
  });

  it('completes an empty string without writing', () => {
    const onDone = vi.fn();
    const onText = vi.fn();
    typeOut('', { stepMs: 10, onText, onDone });
    expect(onText).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('runPhraseLoop', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('types, holds, erases and moves to the next phrase on the shared timing', () => {
    const seen: string[] = [];
    runPhraseLoop({ phrases: ['ab', 'c'], timing: TIMING, onText: (text) => seen.push(text) });
    expect(seen).toEqual(['a']);
    vi.advanceTimersByTime(10);
    expect(seen).toEqual(['a', 'ab']);
    vi.advanceTimersByTime(99);
    expect(seen).toEqual(['a', 'ab']);
    vi.advanceTimersByTime(1 + 5);
    expect(seen).toEqual(['a', 'ab', 'a']);
    vi.advanceTimersByTime(5);
    expect(seen).toEqual(['a', 'ab', 'a', '']);
    vi.advanceTimersByTime(49);
    expect(seen.at(-1)).toBe('');
    vi.advanceTimersByTime(1);
    expect(seen.at(-1)).toBe('c');
  });

  it('reports each wrap back to the first phrase', () => {
    const onWrap = vi.fn();
    runPhraseLoop({ phrases: ['a'], timing: TIMING, onText: () => undefined, onWrap });
    vi.advanceTimersByTime(100 + 5 + 5);
    expect(onWrap).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(50 + 10 + 100 + 5 + 5);
    expect(onWrap).toHaveBeenCalledTimes(2);
  });

  it('holds still while paused and continues from the same place on resume', () => {
    const seen: string[] = [];
    const loop = runPhraseLoop({ phrases: ['ab'], timing: TIMING, onText: (t) => seen.push(t) });
    loop.pause();
    vi.advanceTimersByTime(10);
    const frozen = seen.length;
    vi.advanceTimersByTime(1000);
    expect(seen).toHaveLength(frozen);
    expect(vi.getTimerCount()).toBe(0);
    loop.resume();
    expect(seen.length).toBeGreaterThan(frozen);
  });

  it('can start paused and types nothing until resumed', () => {
    const seen: string[] = [];
    const loop = runPhraseLoop({
      phrases: ['ab'],
      timing: TIMING,
      onText: (t) => seen.push(t),
      startPaused: true,
    });
    expect(seen).toEqual([]);
    loop.resume();
    expect(seen).toEqual(['a']);
  });

  it('resume while running is a no-op', () => {
    const loop = runPhraseLoop({ phrases: ['ab'], timing: TIMING, onText: () => undefined });
    expect(() => loop.resume()).not.toThrow();
    expect(vi.getTimerCount()).toBe(1);
  });

  it('keeps a single pending timer however long it runs', () => {
    runPhraseLoop({ phrases: ['abc', 'de'], timing: TIMING, onText: () => undefined });
    for (let step = 0; step < 200; step++) {
      vi.advanceTimersByTime(20);
      expect(vi.getTimerCount()).toBeLessThanOrEqual(1);
    }
  });

  it('cancels every pending timer', () => {
    const seen: string[] = [];
    const loop = runPhraseLoop({ phrases: ['ab'], timing: TIMING, onText: (t) => seen.push(t) });
    loop.cancel();
    vi.advanceTimersByTime(1000);
    expect(seen).toEqual(['a']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does nothing without phrases', () => {
    const onText = vi.fn();
    const loop = runPhraseLoop({ phrases: [], timing: TIMING, onText });
    vi.advanceTimersByTime(1000);
    expect(onText).not.toHaveBeenCalled();
    expect(() => loop.cancel()).not.toThrow();
  });
});
