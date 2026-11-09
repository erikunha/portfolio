import {
  MOTION_BODY_STATE,
  MOTION_CHANGE_EVENT,
  MOTION_CHOICE,
  MOTION_STORAGE_KEY,
} from './motion-change';

export function readMotion(): boolean {
  try {
    return localStorage.getItem(MOTION_STORAGE_KEY) !== MOTION_CHOICE.off;
  } catch {
    return true;
  }
}

export function applyMotion(on: boolean, persist = true): void {
  document.body.dataset.motion = on ? MOTION_BODY_STATE.full : MOTION_BODY_STATE.reduce;
  if (persist) {
    try {
      localStorage.setItem(MOTION_STORAGE_KEY, on ? MOTION_CHOICE.on : MOTION_CHOICE.off);
    } catch (err) {
      console.warn('[motion] Failed to persist motion preference:', err);
    }
  }
  window.dispatchEvent(new CustomEvent(MOTION_CHANGE_EVENT, { detail: { on } }));
}

export function motionInEffect(): boolean {
  if (typeof document !== 'undefined' && document.body.dataset.motion === MOTION_BODY_STATE.reduce)
    return false;
  return readMotion();
}
