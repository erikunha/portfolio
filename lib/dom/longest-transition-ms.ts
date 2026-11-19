import { MS_PER_SECOND } from '@/lib/time';

const MS_SUFFIX = 'ms';
const LIST_SEPARATOR = ',';

function toMilliseconds(token: string): number {
  const value = Number.parseFloat(token);
  if (Number.isNaN(value)) return 0;
  return token.trim().endsWith(MS_SUFFIX) ? value : value * MS_PER_SECOND;
}

const toList = (value: string): number[] => value.split(LIST_SEPARATOR).map(toMilliseconds);

export function longestTransitionMs(element: Element): number {
  const { transitionDuration, transitionDelay } = getComputedStyle(element);
  const delays = toList(transitionDelay);
  const ends = toList(transitionDuration).map(
    (duration, index) => duration + (delays[index % delays.length] ?? 0),
  );
  return Math.max(0, ...ends);
}
