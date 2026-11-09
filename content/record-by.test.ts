import { describe, expect, it } from 'vitest';
import { recordBy } from './record-by';

describe('recordBy', () => {
  it('keys every item, so a record typed over the items key union is total', () => {
    const items = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ] as const;
    const labels = recordBy(
      items,
      (item) => item.id,
      (item) => item.label,
    );
    expect(Object.keys(labels).sort()).toEqual(items.map((item) => item.id).sort());
    expect(labels).toEqual({ a: 'A', b: 'B' });
  });

  it('lets a later item with the same key win, matching Object.fromEntries', () => {
    expect(
      recordBy(
        [1, 2, 1],
        (n) => (n === 1 ? 'one' : 'two'),
        (n) => n,
      ),
    ).toEqual({ one: 1, two: 2 });
  });
});
