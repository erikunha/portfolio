import { describe, expect, it } from 'vitest';
import { readablePath } from './ErrorPages.client';

const FALLBACK = '/route';
const ZERO_WIDTH_SPACE = 0x200b;
const ZERO_WIDTH_NON_JOINER = 0x200c;
const WORD_JOINER = 0x2060;
const BYTE_ORDER_MARK = 0xfeff;
const TAG_LATIN_A = 0xe0041;
const CANCEL_TAG = 0xe007f;
const FORMAT_CODE_POINTS = [
  ZERO_WIDTH_SPACE,
  ZERO_WIDTH_NON_JOINER,
  WORD_JOINER,
  BYTE_ORDER_MARK,
  TAG_LATIN_A,
  CANCEL_TAG,
];

describe('readablePath format characters', () => {
  it('drops zero width and tag characters so an invisible suffix cannot disguise a path', () => {
    for (const codePoint of FORMAT_CODE_POINTS) {
      const encoded = encodeURIComponent(String.fromCodePoint(codePoint));
      expect(readablePath(`/a${encoded}b`, FALLBACK), `U+${codePoint.toString(16)}`).toBe('/ab');
    }
  });

  it('falls back when only format characters remain', () => {
    const encoded = [ZERO_WIDTH_SPACE, BYTE_ORDER_MARK]
      .map((codePoint) => encodeURIComponent(String.fromCodePoint(codePoint)))
      .join('');
    expect(readablePath(encoded, FALLBACK)).toBe(FALLBACK);
  });
});
