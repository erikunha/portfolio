export const MOTION_CHANGE_EVENT = 'motionchange';

export function subscribeMotion(listener: (on: boolean) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ on?: unknown }>).detail;
    if (typeof detail?.on === 'boolean') listener(detail.on);
  };
  window.addEventListener(MOTION_CHANGE_EVENT, handler);
  return () => window.removeEventListener(MOTION_CHANGE_EVENT, handler);
}
