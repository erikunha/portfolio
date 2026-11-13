import { describe, expect, it } from 'vitest';
import { readablePath } from './ErrorPages.client';

const FALLBACK = '/route';
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const CAP_CODE_POINTS = 64;
const LONG_REPEAT = 100;

describe('readablePath', () => {
  it('never splits an emoji when it shortens a long path', () => {
    for (const lead of ['/', '/a']) {
      const path = readablePath(`${lead}${'😀'.repeat(LONG_REPEAT)}`, FALLBACK);
      expect(path, `lead ${lead}`).not.toMatch(LONE_SURROGATE);
      expect(Array.from(path).length).toBeLessThanOrEqual(CAP_CODE_POINTS);
      expect(path.endsWith('...')).toBe(true);
    }
  });

  it('counts the cap in characters a reader sees, not UTF-16 units', () => {
    const path = `/${'😀'.repeat(CAP_CODE_POINTS - 1)}`;
    expect(readablePath(path, FALLBACK)).toBe(path);
  });

  it('decodes a percent-encoded emoji path before it measures it', () => {
    expect(readablePath(`/${encodeURIComponent('😀')}`, FALLBACK)).toBe('/😀');
  });

  it('falls back when there is no path', () => {
    expect(readablePath(null, FALLBACK)).toBe(FALLBACK);
  });
});
