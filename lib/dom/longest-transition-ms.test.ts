import { describe, expect, it } from 'vitest';
import { longestTransitionMs } from './longest-transition-ms';

function styled(duration: string, delay?: string, property?: string): HTMLElement {
  const element = document.createElement('div');
  element.style.transitionDuration = duration;
  if (delay !== undefined) element.style.transitionDelay = delay;
  if (property !== undefined) element.style.transitionProperty = property;
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
    expect(longestTransitionMs(styled('0.1s, 300ms, 0.25s', undefined, 'a, b, c'))).toBe(300);
    expect(longestTransitionMs(styled('120ms, 0.5s', undefined, 'a, b'))).toBe(500);
  });

  it('is zero for an element with no transition at all', () => {
    expect(longestTransitionMs(document.createElement('div'))).toBe(0);
  });

  it('counts the delay of the transition it belongs to', () => {
    expect(longestTransitionMs(styled('0.2s', '0.1s'))).toBe(300);
    expect(longestTransitionMs(styled('200ms', '50ms'))).toBe(250);
  });

  it('pairs a delay list with the durations and repeats a short delay list', () => {
    expect(longestTransitionMs(styled('100ms, 200ms, 150ms', '0s, 0.4s', 'a, b, c'))).toBe(600);
    expect(longestTransitionMs(styled('100ms, 200ms', '0.5s', 'a, b'))).toBe(700);
  });

  it('pairs each property with its own delay when one duration serves all of them', () => {
    expect(longestTransitionMs(styled('1s', '0s, 1s, 2s', 'a, b, c'))).toBe(3000);
  });

  it('repeats a short duration list and a short delay list to the property count', () => {
    expect(longestTransitionMs(styled('1s, 2s', '0s', 'a, b, c'))).toBe(2000);
    expect(longestTransitionMs(styled('1s, 2s', '0s, 0s, 5s', 'a, b, c'))).toBe(6000);
  });

  it('ignores durations and delays past the property count', () => {
    expect(longestTransitionMs(styled('1s, 5s, 9s', '0s', 'a, b'))).toBe(5000);
    expect(longestTransitionMs(styled('1s', '0s, 1s, 9s', 'a, b'))).toBe(2000);
  });

  it('reads only the first duration and delay when the property is all', () => {
    expect(longestTransitionMs(styled('1s, 5s', '0s, 9s', 'all'))).toBe(1000);
  });

  it('is zero when the transition property is none, whatever the duration', () => {
    expect(longestTransitionMs(styled('1s', '1s', 'none'))).toBe(0);
  });
});
