import { MS_PER_SECOND } from '@/lib/time';

const MS_SUFFIX = 'ms';

function toMilliseconds(token: string): number {
  const value = Number.parseFloat(token);
  if (Number.isNaN(value)) return 0;
  return token.trim().endsWith(MS_SUFFIX) ? value : value * MS_PER_SECOND;
}

export function longestTransitionMs(element: Element): number {
  const { transitionDuration } = getComputedStyle(element);
  return Math.max(0, ...transitionDuration.split(',').map(toMilliseconds));
}
