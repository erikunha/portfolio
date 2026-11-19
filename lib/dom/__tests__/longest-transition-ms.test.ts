import { describe, expect, it } from 'vitest';
import { longestTransitionMs } from '../longest-transition-ms';

function styled(duration: string, delay?: string): HTMLElement {
  const element = document.createElement('div');
  element.style.transitionDuration = duration;
  if (delay !== undefined) element.style.transitionDelay = delay;
  document.body.append(element);
  return element;
}

describe('longestTransitionMs', () => {
  it.each([
    ['0.2s', 200],
    ['200ms', 200],
    ['1s', 1000],
    ['0s', 0],
  ])('reads %s as %d ms', (duration, expected) => {
    expect(longestTransitionMs(styled(duration))).toBe(expected);
  });

  it('takes the longest of a comma list that mixes seconds and milliseconds', () => {
    expect(longestTransitionMs(styled('0.1s, 300ms, 0.25s'))).toBe(300);
    expect(longestTransitionMs(styled('120ms, 0.5s'))).toBe(500);
  });

  it('is zero for an element with no transition at all', () => {
    expect(longestTransitionMs(document.createElement('div'))).toBe(0);
  });

  it('counts the delay of the transition it belongs to', () => {
    expect(longestTransitionMs(styled('0.2s', '0.1s'))).toBe(300);
    expect(longestTransitionMs(styled('200ms', '50ms'))).toBe(250);
  });

  it('pairs a delay list with the durations and repeats a short delay list', () => {
    expect(longestTransitionMs(styled('100ms, 200ms, 150ms', '0s, 0.4s'))).toBe(600);
    expect(longestTransitionMs(styled('100ms, 200ms', '0.5s'))).toBe(700);
  });
});
