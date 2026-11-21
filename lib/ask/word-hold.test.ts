import { describe, expect, it } from 'vitest';
import { createWordHold } from '@/lib/ask/word-hold';

describe('createWordHold', () => {
  it('releases text up to the last whitespace and holds the trailing word', () => {
    const hold = createWordHold();

    expect(hold.push('one two thr')).toBe('one two ');
    expect(hold.push('ee four')).toBe('three ');
    expect(hold.flush()).toBe('four');
  });

  it('holds a word that spans several chunks until whitespace arrives', () => {
    const hold = createWordHold();

    expect(hold.push('gover')).toBe('');
    expect(hold.push('ned')).toBe('');
    expect(hold.push(' next')).toBe('governed ');
  });

  it('releases a chunk that ends on whitespace whole', () => {
    const hold = createWordHold();

    expect(hold.push('alpha beta\n')).toBe('alpha beta\n');
    expect(hold.flush()).toBe('');
  });

  it('treats a newline and a tab as a word boundary', () => {
    const hold = createWordHold();

    expect(hold.push('line one\nline\ttw')).toBe('line one\nline\t');
    expect(hold.flush()).toBe('tw');
  });

  it('flushes the held word once and then holds nothing', () => {
    const hold = createWordHold();
    hold.push('end');

    expect(hold.flush()).toBe('end');
    expect(hold.flush()).toBe('');
  });

  it('returns the empty string for an empty chunk', () => {
    const hold = createWordHold();

    expect(hold.push('')).toBe('');
    expect(hold.flush()).toBe('');
  });

  it('handles a very long unbroken word in linear time', () => {
    const hold = createWordHold();
    const started = performance.now();
    for (let i = 0; i < 4000; i += 1) hold.push('x');

    expect(hold.flush()).toHaveLength(4000);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
