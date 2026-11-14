import { describe, expect, it } from 'vitest';
import { keepTail, splitTail } from './keep-tail';

const NBSP = ' ';

describe('keepTail', () => {
  it('joins a short last word to the word before it', () => {
    expect(keepTail('IELTS General Training · C1 · 2023')).toBe(
      `IELTS General Training · C1${NBSP}·${NBSP}2023`,
    );
  });

  it('joins a level in parentheses to its language', () => {
    expect(keepTail('PT-BR (native) · EN (C1) · ES (B1) · FR (A2)')).toBe(
      `PT-BR (native) · EN (C1) · ES (B1) · FR${NBSP}(A2)`,
    );
  });

  it('keeps a trailing year with the separator and the word before the separator', () => {
    expect(keepTail('Certified · certificates.dev · 2024')).toBe(
      `Certified · certificates.dev${NBSP}·${NBSP}2024`,
    );
  });

  it('joins the closing word of a sentence to the word before it', () => {
    expect(keepTail('Built the shared form library for the Nx.')).toBe(
      `Built the shared form library for the${NBSP}Nx.`,
    );
  });

  it('leaves a long last word alone, so a long run can still wrap', () => {
    const text = 'Contact me at erikhenriquealvescunha@gmail.com';
    expect(keepTail(text)).toBe(text);
  });

  it('leaves a single word and an empty string unchanged', () => {
    expect(keepTail('atual')).toBe('atual');
    expect(keepTail('')).toBe('');
  });

  it('does not change the words, only the one space before the last one', () => {
    const text = 'jun/2026 - atual';
    expect(keepTail(text).replaceAll(NBSP, ' ')).toBe(text);
  });
});

describe('splitTail', () => {
  it('returns the words that stay together as the tail', () => {
    expect(splitTail('Certified · certificates.dev · 2024')).toEqual({
      head: 'Certified ·',
      tail: 'certificates.dev · 2024',
    });
  });

  it('returns an empty tail when the last word is long or alone', () => {
    expect(splitTail('Contact erikhenriquealvescunha@gmail.com')).toEqual({
      head: 'Contact erikhenriquealvescunha@gmail.com',
      tail: '',
    });
    expect(splitTail('atual').tail).toBe('');
  });
});
