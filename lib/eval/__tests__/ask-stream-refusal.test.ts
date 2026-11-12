import { describe, expect, it } from 'vitest';
import { classifyAskStream } from '@/lib/eval/ask-stream';
import { REFUSAL_PREFIX, STREAM_ERR_SENTINEL } from '@/lib/stream-protocol';

const REFUSAL_COPY = 'that question is outside what this assistant answers';

describe('classifyAskStream on a model refusal', () => {
  it('keeps a refusal as an answer so the judge grades it instead of the run counting it as errored', () => {
    const outcome = classifyAskStream(`${STREAM_ERR_SENTINEL}${REFUSAL_PREFIX}${REFUSAL_COPY}`);
    expect(outcome.kind).toBe('answer');
    expect(outcome.kind === 'answer' && outcome.text).toContain(REFUSAL_COPY);
  });

  it('keeps the partial answer that came before the refusal', () => {
    const outcome = classifyAskStream(
      `I will not${STREAM_ERR_SENTINEL}${REFUSAL_PREFIX}${REFUSAL_COPY}`,
    );
    expect(outcome.kind).toBe('answer');
    expect(outcome.kind === 'answer' && outcome.text).toContain('I will not');
  });

  it('still marks an interrupted stream as errored', () => {
    expect(classifyAskStream(`${STREAM_ERR_SENTINEL}the answer was interrupted`).kind).toBe(
      'errored',
    );
  });
});
