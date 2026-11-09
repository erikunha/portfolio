import { observeInView } from './in-view';
import type { PauseControl } from './typewriter';

export const PAUSE_REASON = { Tab: 'tab', Viewport: 'viewport' } as const;

export function pauseWhileHidden(
  host: Element,
  target: Pick<PauseControl, 'pause' | 'resume'>,
): () => void {
  const apply = (reason: string, hidden: boolean) => {
    if (hidden) target.pause(reason);
    else target.resume(reason);
  };
  const onVisibility = () => apply(PAUSE_REASON.Tab, document.hidden);
  document.addEventListener('visibilitychange', onVisibility);
  const unobserve = observeInView(host, (entries) => {
    for (const entry of entries) apply(PAUSE_REASON.Viewport, !entry.isIntersecting);
  });
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    unobserve();
  };
}
