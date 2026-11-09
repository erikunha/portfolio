import { MAIN_CONTENT_ID } from '@/components/PageMain';
import { motionInEffect } from '@/lib/motion';
import { HOME_SECTION_ID } from '@/lib/section-spy';

const SETTLED_TOP_LIMIT_PX = 150;
const PENDING_CORRECTION_TIMEOUT_MS = 3000;
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

let pendingCorrection: AbortController | null = null;

function scrollBehavior(): ScrollBehavior {
  return motionInEffect() ? 'smooth' : 'auto';
}

export function jumpTarget(id: string): HTMLElement | null {
  return document.getElementById(id === HOME_SECTION_ID ? MAIN_CONTENT_ID : id);
}

function correctWhenSettled(target: HTMLElement) {
  const correction = new AbortController();
  pendingCorrection = correction;
  const { signal } = correction;
  const cancel = () => correction.abort();
  window.addEventListener(
    'scrollend',
    () => {
      cancel();
      const { top } = target.getBoundingClientRect();
      if (top < 0 || top > SETTLED_TOP_LIMIT_PX) target.scrollIntoView({ block: 'start' });
    },
    { once: true, signal },
  );
  for (const type of USER_SCROLL_EVENTS) {
    window.addEventListener(type, cancel, { once: true, passive: true, signal });
  }
  const timeout = window.setTimeout(cancel, PENDING_CORRECTION_TIMEOUT_MS);
  signal.addEventListener('abort', () => window.clearTimeout(timeout), { once: true });
}

export function jumpToSection(id: string): boolean {
  const target = jumpTarget(id);
  if (!target) return false;
  pendingCorrection?.abort();
  pendingCorrection = null;
  const behavior = scrollBehavior();
  if (id === HOME_SECTION_ID) window.scrollTo({ top: 0, behavior });
  else {
    target.scrollIntoView({ behavior, block: 'start' });
    correctWhenSettled(target);
  }
  target.focus({ preventScroll: true });
  return true;
}
