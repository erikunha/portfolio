import { MOTION_CHANGE_EVENT } from './motion-change';

export function readMotion(): boolean {
  try {
    return localStorage.getItem('erik.motion') !== 'off';
  } catch {
    return true;
  }
}

export function applyMotion(on: boolean, persist = true): void {
  document.body.dataset.motion = on ? 'full' : 'reduce';
  if (persist) {
    try {
      localStorage.setItem('erik.motion', on ? 'on' : 'off');
    } catch (err) {
      console.warn('[motion] Failed to persist motion preference:', err);
    }
  }
  window.dispatchEvent(new CustomEvent(MOTION_CHANGE_EVENT, { detail: { on } }));
}

export function motionInEffect(): boolean {
  if (typeof document !== 'undefined' && document.body.dataset.motion === 'reduce') return false;
  return readMotion();
}
