export const MOTION_CHANGE_EVENT = 'motionchange';
export const MOTION_STORAGE_KEY = 'erik.motion';

export const MOTION_CHOICE = { on: 'on', off: 'off' } as const;
export const MOTION_BODY_STATE = { full: 'full', reduce: 'reduce' } as const;

export function subscribeMotion(listener: (on: boolean) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ on?: unknown }>).detail;
    if (typeof detail?.on === 'boolean') listener(detail.on);
  };
  window.addEventListener(MOTION_CHANGE_EVENT, handler);
  return () => window.removeEventListener(MOTION_CHANGE_EVENT, handler);
}
