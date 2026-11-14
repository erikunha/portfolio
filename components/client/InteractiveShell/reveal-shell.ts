const SHELL_LIVE_ATTRIBUTE = 'data-shell-live';
const SHELL_LIVE_SELECTOR = `[${SHELL_LIVE_ATTRIBUTE}]`;

export const SHELL_LIVE_PROPS = { [SHELL_LIVE_ATTRIBUTE]: '' } as const;

export function revealShell(from: Element | null): void {
  const live = from?.closest<HTMLElement>(SHELL_LIVE_SELECTOR) ?? null;
  if (!live) return;
  const { top, bottom } = live.getBoundingClientRect();
  if (bottom <= 0 || top >= window.innerHeight) return;
  live.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
}
