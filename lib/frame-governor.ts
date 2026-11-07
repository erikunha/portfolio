import { CRT_BASE_TICK_MS, createEffectStepper } from '@/lib/crt-effect-stepper';
import { readMotion } from '@/lib/motion';
import { subscribeMotion } from '@/lib/motion-change';

export type FrameGovernorConfig = {
  maxLevel: number;
  windowQuantile: number;
  degradeFrameMs: number;
  recoverFrameMs: number;
  windowMs: number;
  minSamples: number;
  minWindowCoverage: number;
  evalIntervalMs: number;
  settleMs: number;
  recoverHoldMs: number;
  recoverHoldMaxMs: number;
  probationMs: number;
  stallResetMs: number;
};

export const FRAME_GOVERNOR_CONFIG: FrameGovernorConfig = {
  maxLevel: 5,
  windowQuantile: 0.75,
  degradeFrameMs: 50,
  recoverFrameMs: 25,
  windowMs: 2000,
  minSamples: 3,
  minWindowCoverage: 0.5,
  evalIntervalMs: 500,
  settleMs: 1500,
  recoverHoldMs: 10_000,
  recoverHoldMaxMs: 160_000,
  probationMs: 30_000,
  stallResetMs: 30_000,
};

export const FRAME_GOVERNOR_RATE_DIVISORS: readonly number[] = [1, 2, 4, 8, 16, 32];
const NO_LEVEL = 0;
const HOLD_GROWTH = 2;
const LEVEL_DATASET_KEY = 'crtLevel';
const SYSFAIL_START = 'sysfail:start';
const SYSFAIL_END = 'sysfail:end';

type Sample = { ts: number; delta: number };

function quantile(samples: Sample[], q: number): number {
  const sorted = samples.map((s) => s.delta).sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
}

export function createFrameGovernor(
  config: FrameGovernorConfig = FRAME_GOVERNOR_CONFIG,
  onLevelChange?: (level: number) => void,
) {
  let level = NO_LEVEL;
  let lastTs: number | null = null;
  let settleUntil = 0;
  let samples: Sample[] = [];
  let lastEvalTs = 0;
  let goodSince: number | null = null;
  let recoverHold = config.recoverHoldMs;
  let probationUntil = 0;

  function forgetSamples() {
    lastTs = null;
    samples = [];
    goodSince = null;
  }

  function moveTo(next: number, ts: number) {
    level = next;
    samples = [];
    goodSince = null;
    lastEvalTs = ts;
    onLevelChange?.(level);
  }

  function degrade(ts: number) {
    if (ts < probationUntil) {
      recoverHold = Math.min(recoverHold * HOLD_GROWTH, config.recoverHoldMaxMs);
    }
    probationUntil = 0;
    moveTo(level + 1, ts);
  }

  function recover(ts: number) {
    probationUntil = ts + config.probationMs;
    moveTo(level - 1, ts);
  }

  function evaluate(ts: number) {
    lastEvalTs = ts;
    const typical = quantile(samples, config.windowQuantile);
    if (typical > config.degradeFrameMs) {
      goodSince = null;
      if (level < config.maxLevel) degrade(ts);
      return;
    }
    if (probationUntil > 0 && ts >= probationUntil) {
      recoverHold = config.recoverHoldMs;
      probationUntil = 0;
    }
    if (level === NO_LEVEL || typical > config.recoverFrameMs) {
      goodSince = null;
      return;
    }
    goodSince ??= ts;
    if (ts - goodSince >= recoverHold) recover(ts);
  }

  function sample(ts: number) {
    if (lastTs === null) {
      lastTs = ts;
      settleUntil = ts + config.settleMs;
      lastEvalTs = settleUntil;
      return;
    }
    const delta = ts - lastTs;
    lastTs = ts;
    if (delta > config.stallResetMs) {
      forgetSamples();
      lastTs = ts;
      settleUntil = ts + config.settleMs;
      lastEvalTs = settleUntil;
      return;
    }
    if (ts < settleUntil) return;
    samples.push({ ts, delta });
    while (samples.length > config.minSamples && (samples[0]?.ts ?? ts) < ts - config.windowMs) {
      samples.shift();
    }
    const spanMs = ts - (samples[0]?.ts ?? ts);
    if (
      samples.length < config.minSamples ||
      spanMs < config.windowMs * config.minWindowCoverage ||
      ts - lastEvalTs < config.evalIntervalMs
    )
      return;
    evaluate(ts);
  }

  return {
    sample,
    pause: forgetSamples,
    getLevel: () => level,
  };
}

type Listener = (level: number) => void;

let holders = 0;
let currentLevel = NO_LEVEL;
let raf = 0;
let sampling = false;
let detach: (() => void) | undefined;
const listeners = new Set<Listener>();

export function getFrameGovernorLevel(): number {
  return currentLevel;
}

export function getFrameGovernorTickMultiplier(): number {
  return FRAME_GOVERNOR_RATE_DIVISORS[currentLevel] ?? 1;
}

export function subscribeFrameGovernor(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(level: number) {
  currentLevel = level;
  document.documentElement.dataset[LEVEL_DATASET_KEY] = String(level);
  for (const listener of listeners) listener(level);
}

function start() {
  const stepper = createEffectStepper();
  let lastStepTs = Number.NEGATIVE_INFINITY;
  const machine = createFrameGovernor(FRAME_GOVERNOR_CONFIG, (level) => {
    stepper.hold();
    lastStepTs = Number.NEGATIVE_INFINITY;
    publish(level);
  });
  document.documentElement.dataset[LEVEL_DATASET_KEY] = String(NO_LEVEL);

  const gates = { motion: readMotion(), visible: !document.hidden, calm: true };

  function tick(ts: number) {
    if (!sampling) return;
    machine.sample(ts);
    if (
      currentLevel > NO_LEVEL &&
      ts - lastStepTs >= CRT_BASE_TICK_MS * getFrameGovernorTickMultiplier()
    ) {
      lastStepTs = ts;
      stepper.step(ts);
    }
    raf = requestAnimationFrame(tick);
  }
  function sync() {
    const next = Object.values(gates).every(Boolean);
    if (next === sampling) return;
    sampling = next;
    machine.pause();
    stepper.hold();
    if (next) raf = requestAnimationFrame(tick);
    else cancelAnimationFrame(raf);
  }
  function setGate(gate: keyof typeof gates, open: boolean) {
    gates[gate] = open;
    sync();
  }

  const unsubscribeMotion = subscribeMotion((on) => setGate('motion', on));
  const onVisibility = () => setGate('visible', !document.hidden);
  const onSysfailStart = () => setGate('calm', false);
  const onSysfailEnd = () => setGate('calm', true);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener(SYSFAIL_START, onSysfailStart);
  window.addEventListener(SYSFAIL_END, onSysfailEnd);
  sync();

  detach = () => {
    sampling = false;
    cancelAnimationFrame(raf);
    unsubscribeMotion();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener(SYSFAIL_START, onSysfailStart);
    window.removeEventListener(SYSFAIL_END, onSysfailEnd);
  };
}

function stop() {
  detach?.();
  detach = undefined;
  currentLevel = NO_LEVEL;
  delete document.documentElement.dataset[LEVEL_DATASET_KEY];
}

export function acquireFrameGovernor(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  holders++;
  if (holders === 1) start();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders--;
    if (holders === 0) stop();
  };
}
