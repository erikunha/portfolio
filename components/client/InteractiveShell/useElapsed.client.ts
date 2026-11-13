'use client';

import { useSyncExternalStore } from 'react';
import { MOTION_BODY_STATE } from '@/lib/motion-change';
import { MS_PER_SECOND } from '@/lib/time';

const TENTH_MS = 100;
const TENTHS_DIGITS = 1;
const INITIAL_READING = (0).toFixed(TENTHS_DIGITS);

const listeners = new Set<() => void>();
let startedAt = 0;
let elapsedMs = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

function wholeSecondsOnly(): boolean {
  return document.body.dataset.motion === MOTION_BODY_STATE.reduce;
}

function reading(): string {
  return wholeSecondsOnly()
    ? String(Math.floor(elapsedMs / MS_PER_SECOND))
    : (elapsedMs / MS_PER_SECOND).toFixed(TENTHS_DIGITS);
}

function untilNextReading(): number {
  return wholeSecondsOnly() ? MS_PER_SECOND - (elapsedMs % MS_PER_SECOND) : TENTH_MS;
}

function tick() {
  elapsedMs = Date.now() - startedAt;
  for (const listener of listeners) listener();
  timer = setTimeout(tick, untilNextReading());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    startedAt = Date.now();
    elapsedMs = 0;
    timer = setTimeout(tick, untilNextReading());
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
}

export function useElapsedSeconds(): string {
  return useSyncExternalStore(subscribe, reading, () => INITIAL_READING);
}
