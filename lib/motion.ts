export function readMotion(): boolean {
  try {
    const stored = localStorage.getItem('erik.motion');
    if (stored === 'on') return true;
    if (stored === 'off') return false;
    // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
  } catch {}
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return true;
}

export function readSystemReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  window.dispatchEvent(new CustomEvent('motionchange', { detail: { on } }));
}

export function motionInEffect(): boolean {
  if (typeof document !== 'undefined' && document.body.dataset.motion === 'reduce') return false;
  return readMotion();
}
