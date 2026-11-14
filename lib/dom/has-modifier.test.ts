import { describe, expect, it } from 'vitest';
import { hasModifier } from './has-modifier';

const NONE = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

describe('hasModifier', () => {
  it('is false with no modifier held', () => {
    expect(hasModifier(NONE)).toBe(false);
  });

  it.each(['altKey', 'ctrlKey', 'metaKey', 'shiftKey'] as const)(
    'is true when %s is held',
    (key) => {
      expect(hasModifier({ ...NONE, [key]: true })).toBe(true);
    },
  );

  it('ignores a modifier the caller allows', () => {
    expect(hasModifier({ ...NONE, shiftKey: true }, ['shiftKey'])).toBe(false);
  });

  it('still reports a modifier that is not allowed', () => {
    expect(hasModifier({ ...NONE, shiftKey: true, ctrlKey: true }, ['shiftKey'])).toBe(true);
  });
});
