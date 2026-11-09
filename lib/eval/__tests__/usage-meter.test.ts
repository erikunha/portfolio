import { describe, expect, it } from 'vitest';
import { emitAskUsage } from '@/lib/ask/usage';
import { createUsageMeter } from '@/lib/eval/usage-meter';

const event = (requestId: string) => ({
  requestId,
  usageResolved: true,
  billedInputTokens: 3000,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 100,
});

describe('createUsageMeter', () => {
  it('returns an event that arrived before take()', async () => {
    const meter = createUsageMeter();
    emitAskUsage(event('a'));
    expect((await meter.take('a', 50))?.requestId).toBe('a');
    meter.dispose();
  });

  it('resolves a pending take() when the event arrives later', async () => {
    const meter = createUsageMeter();
    const pending = meter.take('b', 500);
    emitAskUsage(event('b'));
    expect((await pending)?.billedInputTokens).toBe(3000);
    meter.dispose();
  });

  it('returns null when no event arrives before the deadline', async () => {
    const meter = createUsageMeter();
    expect(await meter.take('never', 10)).toBeNull();
    meter.dispose();
  });

  it('stops collecting after dispose()', async () => {
    const meter = createUsageMeter();
    meter.dispose();
    emitAskUsage(event('c'));
    expect(await meter.take('c', 10)).toBeNull();
  });
});
