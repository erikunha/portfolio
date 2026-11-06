import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMotion } from '@/lib/motion';
import {
  FRAME_GOVERNOR_CONFIG as CONFIG,
  createFrameGovernor,
  type FrameGovernorConfig,
} from './frame-governor';

const CAPABLE_FRAME_MS = 16.7;
const DEAD_BAND_FRAME_MS = 35;
const OVERLOADED_FRAME_MS = 80;
const STALL_FRAME_MS = 500;
const BURST_STALL_FRAME_MS = 300;
const SETTLE_AND_WINDOW_MS = CONFIG.settleMs + CONFIG.windowMs;
const SECOND_MS = 1000;
const EFFECT_START_MS = 4000;

type Governor = ReturnType<typeof createFrameGovernor>;

function feed(governor: Governor, from: number, durationMs: number, frameMs: number): number {
  let t = from;
  const end = from + durationMs;
  while (t < end) {
    t += frameMs;
    governor.sample(t);
  }
  return t;
}

function feedUntilLevel(
  governor: Governor,
  from: number,
  level: number,
  frameMs: number,
  limitMs = 5 * 60 * SECOND_MS,
): number {
  let t = from;
  const end = from + limitMs;
  while (governor.getLevel() !== level && t < end) {
    t += frameMs;
    governor.sample(t);
  }
  return t;
}

describe('frame governor state machine', () => {
  it('stays at level 0 while frames meet the budget', () => {
    const governor = createFrameGovernor();
    feed(governor, 0, 5 * 60 * SECOND_MS, CAPABLE_FRAME_MS);
    expect(governor.getLevel(), 'a capable device must never leave full rate').toBe(0);
  });

  it('degrades on frames that alternate fast callbacks with long stalls even when the median is fast', () => {
    const governor = createFrameGovernor();
    let t = 0;
    while (t < 60 * SECOND_MS && governor.getLevel() === 0) {
      for (const frameMs of [CAPABLE_FRAME_MS, CAPABLE_FRAME_MS, BURST_STALL_FRAME_MS]) {
        t += frameMs;
        governor.sample(t);
      }
    }
    expect(
      governor.getLevel(),
      'software compositors deliver callbacks in bursts around a long paint: the median of those frames is fast while a third of the time is stalled',
    ).toBeGreaterThan(0);
  });

  it('stays at level 0 on a device locked to 30 frames per second', () => {
    const governor = createFrameGovernor();
    feed(governor, 0, 2 * 60 * SECOND_MS, 33.4);
    expect(governor.getLevel()).toBe(0);
  });

  it('degrades one level at a time while the slow-frame percentile of the window exceeds the budget', () => {
    const levels: number[] = [];
    const governor = createFrameGovernor(CONFIG, (level) => levels.push(level));
    feed(governor, 0, 5 * 60 * SECOND_MS, OVERLOADED_FRAME_MS);
    expect(levels, 'steps must be adjacent and stop at the last level').toEqual(
      Array.from({ length: CONFIG.maxLevel }, (_, i) => i + 1),
    );
    expect(governor.getLevel()).toBe(CONFIG.maxLevel);
  });

  it('ignores the settle period after the first frame', () => {
    const governor = createFrameGovernor();
    feed(governor, 0, CONFIG.settleMs - SECOND_MS, OVERLOADED_FRAME_MS);
    expect(governor.getLevel(), 'load-time jank must not count against the device').toBe(0);
  });

  it('ignores a short burst of slow frames inside a healthy window', () => {
    const governor = createFrameGovernor();
    let t = feed(governor, 0, SETTLE_AND_WINDOW_MS, CAPABLE_FRAME_MS);
    for (let i = 0; i < 3; i++) {
      t += STALL_FRAME_MS;
      governor.sample(t);
      t = feed(governor, t, SECOND_MS, CAPABLE_FRAME_MS);
    }
    expect(governor.getLevel(), 'the percentile must absorb a hiccup').toBe(0);
  });

  it('holds a level when frames sit between the recovery and degrade thresholds', () => {
    const governor = createFrameGovernor();
    let t = feedUntilLevel(governor, 0, 1, OVERLOADED_FRAME_MS);
    t = feed(governor, t, 10 * 60 * SECOND_MS, DEAD_BAND_FRAME_MS);
    expect(governor.getLevel(), 'the dead band is what stops the level oscillating').toBe(1);
  });

  it('steps back up only after frames stay under the recovery threshold for the hold', () => {
    const governor = createFrameGovernor();
    let t = feedUntilLevel(governor, 0, 1, OVERLOADED_FRAME_MS);
    t = feed(governor, t, 5 * SECOND_MS, DEAD_BAND_FRAME_MS);
    t = feed(governor, t, CONFIG.recoverHoldMs - 2 * SECOND_MS, CAPABLE_FRAME_MS);
    expect(governor.getLevel(), 'recovery must wait out the hold').toBe(1);
    feed(governor, t, 4 * SECOND_MS, CAPABLE_FRAME_MS);
    expect(governor.getLevel()).toBe(0);
  });

  it('restarts the hold when a window goes back over the recovery threshold', () => {
    const governor = createFrameGovernor();
    let t = feedUntilLevel(governor, 0, 1, OVERLOADED_FRAME_MS);
    t = feed(governor, t, CONFIG.recoverHoldMs - 3 * SECOND_MS, CAPABLE_FRAME_MS);
    t = feed(governor, t, 2 * CONFIG.windowMs, DEAD_BAND_FRAME_MS);
    t = feed(governor, t, CONFIG.recoverHoldMs - 3 * SECOND_MS, CAPABLE_FRAME_MS);
    expect(governor.getLevel(), 'two short good spells must not add up to a hold').toBe(1);
  });

  it('doubles the hold after a recovery that the device could not sustain', () => {
    const governor = createFrameGovernor();
    let t = feedUntilLevel(governor, 0, 1, OVERLOADED_FRAME_MS);
    t = feedUntilLevel(governor, t, 0, CAPABLE_FRAME_MS);
    t = feedUntilLevel(governor, t, 1, OVERLOADED_FRAME_MS);
    t = feed(governor, t, CONFIG.recoverHoldMs + 3 * SECOND_MS, CAPABLE_FRAME_MS);
    expect(governor.getLevel(), 'a failed recovery must wait longer next time').toBe(1);
    feed(governor, t, CONFIG.recoverHoldMs + 3 * SECOND_MS, CAPABLE_FRAME_MS);
    expect(governor.getLevel()).toBe(0);
  });

  it('returns to the base hold once a recovery has lasted through its probation', () => {
    const governor = createFrameGovernor();
    let t = feedUntilLevel(governor, 0, 1, OVERLOADED_FRAME_MS);
    t = feedUntilLevel(governor, t, 0, CAPABLE_FRAME_MS);
    t = feedUntilLevel(governor, t, 1, OVERLOADED_FRAME_MS);
    t = feedUntilLevel(governor, t, 0, CAPABLE_FRAME_MS);
    t = feed(governor, t, CONFIG.probationMs + 2 * SECOND_MS, CAPABLE_FRAME_MS);
    t = feedUntilLevel(governor, t, 1, OVERLOADED_FRAME_MS);
    t = feed(governor, t, CONFIG.recoverHoldMs + 3 * SECOND_MS, CAPABLE_FRAME_MS);
    expect(governor.getLevel(), 'a held recovery must clear the penalty').toBe(0);
  });

  it('never grows the hold past its ceiling', () => {
    const governor = createFrameGovernor({ ...CONFIG, recoverHoldMaxMs: CONFIG.recoverHoldMs });
    let t = feedUntilLevel(governor, 0, 1, OVERLOADED_FRAME_MS);
    for (let i = 0; i < 3; i++) {
      t = feedUntilLevel(governor, t, 0, CAPABLE_FRAME_MS);
      t = feedUntilLevel(governor, t, 1, OVERLOADED_FRAME_MS);
    }
    t = feed(governor, t, CONFIG.recoverHoldMs + 3 * SECOND_MS, CAPABLE_FRAME_MS);
    expect(governor.getLevel()).toBe(0);
  });
});

describe('frame governor pause', () => {
  const SINGLE_SAMPLE: FrameGovernorConfig = {
    ...CONFIG,
    minSamples: 1,
    settleMs: 0,
    evalIntervalMs: 0,
  };
  const HIDDEN_GAP_MS = 4000;

  it('does not read the gap across a pause as a slow frame', () => {
    const governor = createFrameGovernor(SINGLE_SAMPLE);
    const t = feed(governor, 0, SECOND_MS, CAPABLE_FRAME_MS);
    governor.pause();
    governor.sample(t + HIDDEN_GAP_MS);
    expect(governor.getLevel(), 'a hidden tab is not a slow device').toBe(0);
    feed(governor, t + HIDDEN_GAP_MS, SECOND_MS, CAPABLE_FRAME_MS);
    expect(governor.getLevel()).toBe(0);
  });

  it('counts the same gap as a slow frame when no pause happened', () => {
    const governor = createFrameGovernor(SINGLE_SAMPLE);
    const t = feed(governor, 0, SECOND_MS, CAPABLE_FRAME_MS);
    governor.sample(t + HIDDEN_GAP_MS);
    expect(governor.getLevel()).toBe(1);
  });

  it('keeps the level across a pause', () => {
    const governor = createFrameGovernor();
    let t = feedUntilLevel(governor, 0, 2, OVERLOADED_FRAME_MS);
    governor.pause();
    t += HIDDEN_GAP_MS;
    feed(governor, t, SECOND_MS, CAPABLE_FRAME_MS);
    expect(governor.getLevel(), 'a pause forgets samples, not what the device proved').toBe(2);
  });

  it('settles again after a pause before judging frames', () => {
    const governor = createFrameGovernor();
    let t = feed(governor, 0, SETTLE_AND_WINDOW_MS, CAPABLE_FRAME_MS);
    governor.pause();
    t += HIDDEN_GAP_MS;
    governor.sample(t);
    feed(governor, t, CONFIG.settleMs - SECOND_MS, OVERLOADED_FRAME_MS);
    expect(
      governor.getLevel(),
      'the first frames after a tab returns are slow for any device',
    ).toBe(0);
  });

  it('treats a gap beyond the stall limit as a pause', () => {
    const governor = createFrameGovernor(SINGLE_SAMPLE);
    const t = feed(governor, 0, SECOND_MS, CAPABLE_FRAME_MS);
    governor.sample(t + CONFIG.stallResetMs + SECOND_MS);
    expect(governor.getLevel(), 'a sleeping machine is not a slow device').toBe(0);
  });
});

describe('frame governor runtime', () => {
  let effects: HTMLElement[];
  let clocks: Array<{ currentTime: number }>;
  let pending: Array<{ id: number; cb: FrameRequestCallback }>;
  let nextId: number;
  let cancelled: number[];

  function setHidden(hidden: boolean) {
    Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  function step(ts: number) {
    const entry = pending.shift();
    if (entry) entry.cb(ts);
  }

  function runFrames(from: number, durationMs: number, frameMs: number): number {
    let t = from;
    const end = from + durationMs;
    while (t < end && pending.length > 0) {
      t += frameMs;
      step(t);
    }
    return t;
  }

  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    pending = [];
    cancelled = [];
    nextId = 0;
    clocks = [];
    effects = ['crt-noise', 'crt-flicker', 'crt-scan-beam'].map((name) => {
      const el = document.createElement('div');
      el.className = name;
      const clock = { currentTime: EFFECT_START_MS };
      clocks.push(clock);
      (el as unknown as { getAnimations: () => unknown[] }).getAnimations = () => [clock];
      document.body.appendChild(el);
      return el;
    });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      nextId++;
      pending.push({ id: nextId, cb });
      return nextId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      cancelled.push(id);
      pending = pending.filter((entry) => entry.id !== id);
    });
  });

  afterEach(() => {
    for (const el of effects) el.remove();
    setHidden(false);
    document.documentElement.removeAttribute('data-crt-level');
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('samples frames only between acquire and release', async () => {
    const { acquireFrameGovernor } = await import('./frame-governor');
    expect(pending).toHaveLength(0);
    const release = acquireFrameGovernor();
    expect(pending).toHaveLength(1);
    release();
    expect(pending, 'release must cancel the pending frame').toHaveLength(0);
    expect(cancelled).toHaveLength(1);
  });

  it('publishes the level as data-crt-level and to subscribers', async () => {
    const { acquireFrameGovernor, subscribeFrameGovernor, getFrameGovernorTickMultiplier } =
      await import('./frame-governor');
    const heard: number[] = [];
    const unsubscribe = subscribeFrameGovernor((level) => heard.push(level));
    const release = acquireFrameGovernor();
    expect(document.documentElement.dataset.crtLevel).toBe('0');
    expect(getFrameGovernorTickMultiplier()).toBe(1);

    runFrames(0, 60 * SECOND_MS, OVERLOADED_FRAME_MS);

    expect(heard[0]).toBe(1);
    expect(document.documentElement.dataset.crtLevel).toBe(String(heard.at(-1)));
    expect(getFrameGovernorTickMultiplier()).toBeGreaterThan(1);
    unsubscribe();
    release();
  });

  it('removes the attribute and returns to full rate when the last holder releases', async () => {
    const { acquireFrameGovernor, getFrameGovernorLevel, getFrameGovernorTickMultiplier } =
      await import('./frame-governor');
    const releaseA = acquireFrameGovernor();
    const releaseB = acquireFrameGovernor();
    runFrames(0, 60 * SECOND_MS, OVERLOADED_FRAME_MS);
    expect(getFrameGovernorLevel()).toBeGreaterThan(0);

    releaseA();
    expect(pending, 'one holder is still sampling').toHaveLength(1);
    expect(getFrameGovernorLevel()).toBeGreaterThan(0);

    releaseB();
    expect(getFrameGovernorLevel()).toBe(0);
    expect(getFrameGovernorTickMultiplier()).toBe(1);
    expect(document.documentElement.hasAttribute('data-crt-level')).toBe(false);
  });

  it('pauses while the tab is hidden and resumes without losing the level', async () => {
    const { acquireFrameGovernor, getFrameGovernorLevel } = await import('./frame-governor');
    const release = acquireFrameGovernor();
    const t = runFrames(0, 60 * SECOND_MS, OVERLOADED_FRAME_MS);
    const level = getFrameGovernorLevel();
    expect(level).toBeGreaterThan(0);

    setHidden(true);
    expect(pending, 'a hidden tab must schedule no frame').toHaveLength(0);

    setHidden(false);
    expect(pending).toHaveLength(1);
    runFrames(t + 60 * SECOND_MS, 5 * SECOND_MS, CAPABLE_FRAME_MS);
    expect(getFrameGovernorLevel()).toBe(level);
    release();
  });

  it('schedules nothing while motion is off and starts when it is switched on', async () => {
    localStorage.setItem('erik.motion', 'off');
    const { acquireFrameGovernor } = await import('./frame-governor');
    const release = acquireFrameGovernor();
    expect(pending, 'with motion off there is nothing to measure').toHaveLength(0);

    applyMotion(true);
    expect(pending).toHaveLength(1);

    applyMotion(false);
    expect(pending).toHaveLength(0);
    release();
  });

  it('does not restart on a tab return while motion is off', async () => {
    localStorage.setItem('erik.motion', 'off');
    const { acquireFrameGovernor } = await import('./frame-governor');
    const release = acquireFrameGovernor();
    setHidden(true);
    setHidden(false);
    expect(pending).toHaveLength(0);
    release();
  });

  it('pauses during the system-failure beat', async () => {
    const { acquireFrameGovernor } = await import('./frame-governor');
    const release = acquireFrameGovernor();
    window.dispatchEvent(new CustomEvent('sysfail:start'));
    expect(pending, 'frozen animations would read as a fast device').toHaveLength(0);
    window.dispatchEvent(new CustomEvent('sysfail:end'));
    expect(pending).toHaveLength(1);
    release();
  });

  function runUntilLevel(
    getLevel: () => number,
    level: number,
    from: number,
    frameMs: number,
  ): number {
    let t = from;
    while (getLevel() !== level && pending.length > 0 && t < from + 600 * SECOND_MS) {
      t += frameMs;
      step(t);
    }
    return t;
  }

  function distinctClocks(from: number, durationMs: number): number {
    const seen = new Set<number>();
    let t = from;
    const end = from + durationMs;
    while (t < end && pending.length > 0) {
      t += CAPABLE_FRAME_MS;
      step(t);
      seen.add(clocks[0]?.currentTime ?? 0);
    }
    return seen.size;
  }

  it('leaves the CSS animations alone while the device keeps up', async () => {
    const { acquireFrameGovernor } = await import('./frame-governor');
    const release = acquireFrameGovernor();
    runFrames(0, 30 * SECOND_MS, CAPABLE_FRAME_MS);
    expect(
      clocks.map((c) => c.currentTime),
      'full rate must never move an animation clock',
    ).toEqual([EFFECT_START_MS, EFFECT_START_MS, EFFECT_START_MS]);
    release();
  });

  it('steps the paused CRT effects at the level interval once the device falls behind', async () => {
    const { acquireFrameGovernor, getFrameGovernorLevel } = await import('./frame-governor');
    const { CRT_BASE_TICK_MS } = await import('./crt-effect-stepper');
    const release = acquireFrameGovernor();
    const t = runUntilLevel(getFrameGovernorLevel, 2, 0, OVERLOADED_FRAME_MS);
    expect(getFrameGovernorLevel()).toBe(2);

    const window = 2 * SECOND_MS;
    const count = distinctClocks(t, window);
    const expected = window / (CRT_BASE_TICK_MS * 4);
    expect(count, 'level 2 steps the effects once per four base ticks').toBeGreaterThanOrEqual(
      expected - 1,
    );
    expect(count).toBeLessThanOrEqual(expected + 1);
    release();
  });

  it('advances the effect clocks by real time, so the animation keeps its speed', async () => {
    const { acquireFrameGovernor, getFrameGovernorLevel } = await import('./frame-governor');
    const release = acquireFrameGovernor();
    const t = runUntilLevel(getFrameGovernorLevel, 1, 0, OVERLOADED_FRAME_MS);
    const before = clocks[0]?.currentTime ?? 0;
    runFrames(t, 4 * SECOND_MS, CAPABLE_FRAME_MS);
    const advanced = (clocks[0]?.currentTime ?? 0) - before;
    expect(advanced).toBeGreaterThan(3 * SECOND_MS);
    expect(advanced).toBeLessThanOrEqual(4 * SECOND_MS + 100);
    release();
  });

  it('does not count the time spent at full rate when the device falls behind again', async () => {
    const { acquireFrameGovernor, getFrameGovernorLevel } = await import('./frame-governor');
    const release = acquireFrameGovernor();
    let t = runUntilLevel(getFrameGovernorLevel, 1, 0, OVERLOADED_FRAME_MS);
    t = runUntilLevel(getFrameGovernorLevel, 0, t, CAPABLE_FRAME_MS);
    const clock = clocks[0]?.currentTime;
    t = runFrames(t, 120 * SECOND_MS, CAPABLE_FRAME_MS);
    runUntilLevel(getFrameGovernorLevel, 1, t, OVERLOADED_FRAME_MS);
    expect(
      clocks[0]?.currentTime,
      'the CSS animation already advanced while it ran, so the stepper must resume from where the clock stands',
    ).toBe(clock);
    release();
  });

  it('does not fast-forward the effects across a hidden tab', async () => {
    const { acquireFrameGovernor, getFrameGovernorLevel } = await import('./frame-governor');
    const release = acquireFrameGovernor();
    const t = runUntilLevel(getFrameGovernorLevel, 1, 0, OVERLOADED_FRAME_MS);
    runFrames(t, SECOND_MS, CAPABLE_FRAME_MS);
    const before = clocks[0]?.currentTime;

    setHidden(true);
    setHidden(false);
    step(t + 60 * SECOND_MS);

    expect(clocks[0]?.currentTime).toBe(before);
    release();
  });
});
