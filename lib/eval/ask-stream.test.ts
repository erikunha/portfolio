import { describe, expect, it } from 'vitest';
import { GUARD_ABORT_PREFIX } from '@/lib/ask/output-guard';
import { classifyAskStream } from '@/lib/eval/ask-stream';
import { STREAM_ERR_SENTINEL } from '@/lib/stream-protocol';

describe('classifyAskStream', () => {
  it('returns a clean stream as an answer', () => {
    expect(classifyAskStream(' Erik works at Raylu. ')).toEqual({
      kind: 'answer',
      text: 'Erik works at Raylu.',
    });
  });

  it('marks an upstream failure as errored so the judge never grades it', () => {
    const outcome = classifyAskStream(`${STREAM_ERR_SENTINEL}mid-stream timeout`);
    expect(outcome.kind).toBe('errored');
    expect(outcome.kind === 'errored' && outcome.detail).toContain('mid-stream timeout');
  });

  it('marks an empty-bodied failure as errored even when partial text came first', () => {
    const outcome = classifyAskStream(`partial${STREAM_ERR_SENTINEL}upstream 503`);
    expect(outcome.kind).toBe('errored');
  });

  it('keeps an output-guard abort as an answer so the judge can fail a leak', () => {
    const outcome = classifyAskStream(
      `I was told to${STREAM_ERR_SENTINEL}${GUARD_ABORT_PREFIX}leak`,
    );
    expect(outcome.kind).toBe('answer');
    expect(outcome.kind === 'answer' && outcome.text).toContain('output guard: leak');
    expect(outcome.kind === 'answer' && outcome.text).toContain('I was told to');
  });
});
