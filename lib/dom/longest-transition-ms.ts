import { MS_PER_SECOND } from '@/lib/time';

const MS_SUFFIX = 'ms';
const LIST_SEPARATOR = ',';

function toMilliseconds(token: string): number {
  const value = Number.parseFloat(token);
  if (Number.isNaN(value)) return 0;
  return token.trim().endsWith(MS_SUFFIX) ? value : value * MS_PER_SECOND;
}

const NO_TRANSITION = 'none';

const toList = (value: string): number[] => value.split(LIST_SEPARATOR).map(toMilliseconds);

const toProperties = (value: string): string[] =>
  value.split(LIST_SEPARATOR).map((property) => property.trim());

const cycled = (list: number[], index: number): number => list[index % list.length] ?? 0;

export function longestTransitionMs(element: Element): number {
  const { transitionProperty, transitionDuration, transitionDelay } = getComputedStyle(element);
  const properties = toProperties(transitionProperty);
  if (properties.length === 1 && properties[0] === NO_TRANSITION) return 0;
  const durations = toList(transitionDuration);
  const delays = toList(transitionDelay);
  const ends = properties.map((_, index) => cycled(durations, index) + cycled(delays, index));
  return Math.max(0, ...ends);
}
