// lib/motion.ts
// Single source of truth for the data-motion attribute on <body>.
// CRTOverlay reads and reacts to system preference.
// DesktopTopbar writes the user toggle.
// Nothing else should touch document.body.dataset.motion directly.

export function readMotion(): boolean {
  try {
    const stored = localStorage.getItem('erik.motion');
    if (stored === 'on') return true;
    if (stored === 'off') return false;
  } catch {
    // localStorage unavailable (private browsing, etc.)
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return true;
}

export function applyMotion(on: boolean): void {
  // Direct dataset write — called from useLayoutEffect (DesktopTopbar) so it
  // runs before the first paint. setState would fire after paint and cause a
  // visible flash of incorrect motion state.
  document.body.dataset.motion = on ? 'full' : 'reduce';
  try {
    localStorage.setItem('erik.motion', on ? 'on' : 'off');
  } catch {
    // ignore write failure
  }
  // Notify JS-driven animations (MatrixRain, RoleTyper) so they stop/start
  // immediately without waiting for a page reload.
  window.dispatchEvent(new CustomEvent('motionchange', { detail: { on } }));
}
