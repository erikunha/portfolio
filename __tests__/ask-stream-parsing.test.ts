import { describe, expect, it } from 'vitest';
import { parseStreamChunk, STREAM_ERR_SENTINEL } from '@/lib/stream-protocol';

describe('parseStreamChunk — /api/ask stream protocol', () => {
  it('returns the whole buffer as displayText when there is no sentinel', () => {
    const result = parseStreamChunk('Erik has 8 years of frontend experience.');
    expect(result.ok).toBe(true);
    expect(result.displayText).toBe('Erik has 8 years of frontend experience.');
  });

  it('trims surrounding whitespace from the display text', () => {
    const result = parseStreamChunk('  \n  hello world  \n');
    expect(result.ok).toBe(true);
    expect(result.displayText).toBe('hello world');
  });

  it('splits display text from the error message when the sentinel is present', () => {
    const buffer = `Partial answer so far${STREAM_ERR_SENTINEL}rate limit exceeded`;
    const result = parseStreamChunk(buffer);
    expect(result.displayText).toBe('Partial answer so far');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorMessage).toBe('rate limit exceeded');
  });

  it('handles a stream that errors before any answer text arrived', () => {
    const buffer = `${STREAM_ERR_SENTINEL}upstream 503`;
    const result = parseStreamChunk(buffer);
    expect(result.ok).toBe(false);
    expect(result.displayText).toBe('');
    if (!result.ok) expect(result.errorMessage).toBe('upstream 503');
  });

  it('falls back to a generic message when the sentinel carries no detail', () => {
    const buffer = `Some answer${STREAM_ERR_SENTINEL}`;
    const result = parseStreamChunk(buffer);
    expect(result.ok).toBe(false);
    expect(result.displayText).toBe('Some answer');
    if (!result.ok) expect(result.errorMessage).toBe('upstream error');
  });

  it('is stable across progressive accumulation — display text only grows', () => {
    const chunks = ['Erik ', 'is a ', 'senior ', 'engineer.'];
    let accumulated = '';
    const displays: string[] = [];
    for (const chunk of chunks) {
      accumulated += chunk;
      displays.push(parseStreamChunk(accumulated).displayText);
    }
    expect(displays).toEqual([
      'Erik',
      'Erik is a',
      'Erik is a senior',
      'Erik is a senior engineer.',
    ]);
    for (let i = 1; i < displays.length; i++) {
      const prev = displays[i - 1] ?? '';
      const curr = displays[i] ?? '';
      expect(curr.startsWith(prev)).toBe(true);
    }
  });

  it('keeps answer text intact when a chunk boundary splits the sentinel', () => {
    const partial = parseStreamChunk('answer text\x00ER');
    expect(partial.ok).toBe(true);

    const complete = parseStreamChunk(`answer text${STREAM_ERR_SENTINEL}boom`);
    expect(complete.displayText).toBe('answer text');
    expect(complete.ok).toBe(false);
    if (!complete.ok) expect(complete.errorMessage).toBe('boom');
  });
});
