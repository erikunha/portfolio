import { describe, expect, it } from 'vitest';
import { cn } from './cn';
import { joinClassNames } from './join-class-names';

describe('joinClassNames', () => {
  it('joins string parts with one space', () => {
    expect(joinClassNames('a', 'b', 'c')).toBe('a b c');
  });

  it('drops false, null, undefined and empty parts', () => {
    expect(joinClassNames('a', false, null, undefined, '', 'b')).toBe('a b');
  });

  it('returns an empty string when no part survives', () => {
    expect(joinClassNames()).toBe('');
    expect(joinClassNames(false, undefined)).toBe('');
  });

  it('keeps the order of the parts', () => {
    expect(joinClassNames('z', 'a')).toBe('z a');
  });

  it('matches cn for every string-only input the shell passes', () => {
    const open = true as boolean;
    const motionOn = false as boolean;
    const className: string | undefined = undefined;
    expect(joinClassNames('section-menu', open && 'is-open')).toBe(
      cn('section-menu', open && 'is-open'),
    );
    expect(joinClassNames(!motionOn && 'opacity-40')).toBe(cn(!motionOn && 'opacity-40'));
    expect(joinClassNames('flex-none', className)).toBe(cn('flex-none', className));
    expect(joinClassNames('status-dot', motionOn && 'status-dot-blink', 'x')).toBe(
      cn('status-dot', motionOn && 'status-dot-blink', 'x'),
    );
  });
});
