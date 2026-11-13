import { describe, expect, it } from 'vitest';
import { readablePath } from './ErrorPages.client';

const FALLBACK = '/route';
const RIGHT_TO_LEFT_OVERRIDE = '%E2%80%AE';
const BIDI_CONTROLS = ['‎', '‏', '؜', '‪', '‫', '‬', '‭', '‮', '⁦', '⁧', '⁨', '⁩'];

describe('readablePath controls', () => {
  it('drops a right-to-left override so a reversed extension cannot spoof the command', () => {
    expect(readablePath(`/${RIGHT_TO_LEFT_OVERRIDE}txt.exe`, FALLBACK)).toBe('/txt.exe');
  });

  it('drops every bidi mark, embedding, override and isolate', () => {
    for (const control of BIDI_CONTROLS) {
      const code = control.codePointAt(0)?.toString(16);
      expect(readablePath(`/a${encodeURIComponent(control)}b`, FALLBACK), `U+${code}`).toBe('/ab');
    }
  });

  it('drops line breaks and other C0 and C1 controls so the line stays one line', () => {
    expect(readablePath('/a%0Ab%0Dc%00d%1Be%7Ff%C2%85g%C2%9Fh', FALLBACK)).toBe('/abcdefgh');
  });

  it('keeps the characters the controls sat between, joiners and accents included', () => {
    expect(readablePath(`/${encodeURIComponent('👨‍👩‍👧')}/caf%C3%A9`, FALLBACK)).toBe(
      '/👨‍👩‍👧/café',
    );
  });

  it('falls back when nothing readable is left', () => {
    expect(readablePath('%0A%E2%80%AE', FALLBACK)).toBe(FALLBACK);
  });

  it('strips controls from a path that does not decode', () => {
    expect(readablePath('/%E0%A4%A‮file', FALLBACK)).toBe('/%E0%A4%Afile');
  });
});
