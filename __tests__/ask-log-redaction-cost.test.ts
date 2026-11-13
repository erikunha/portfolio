import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMAIL_PLACEHOLDER } from '@/lib/ask/redact-pii';

const QUESTION_BODY_BYTES = 8_192;
const LOGGED_QUESTION_CHARS = 500;
const PERSIST_TIME_BOUND_MS = 100;

const redisSet = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => 'OK'));

vi.mock('@/lib/rate-limit', () => ({ getRedis: vi.fn(() => ({ set: redisSet })) }));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const interaction = {
  requestId: 'req-cost',
  ts: '2026-11-13T12:00:00.000Z',
  ipHash: 'hashed-ip',
  answer: 'A',
  inputTokens: 10,
  outputTokens: 20,
  durationMs: 100,
  status: 'completed' as const,
};

async function storedQuestion(question: string): Promise<string> {
  const { persistAskInteraction } = await import('@/lib/ask-log');
  await persistAskInteraction({ ...interaction, question });
  const [, value] = redisSet.mock.calls.at(-1) ?? [];
  return (JSON.parse(String(value)) as { question: string }).question;
}

describe('ask log redaction cost and cut', () => {
  beforeEach(() => {
    redisSet.mockClear();
  });

  it.each([
    ['hyphen-separated digits', '1-'.repeat(QUESTION_BODY_BYTES / 2)],
    ['one long local-part run', 'a'.repeat(QUESTION_BODY_BYTES)],
    ['letters then an unfinished domain', `${'a'.repeat(QUESTION_BODY_BYTES - 2)}@b`],
  ])('persists an 8KB question of %s inside the time bound', async (_label, question) => {
    const { persistAskInteraction } = await import('@/lib/ask-log');
    await persistAskInteraction({ ...interaction, question: 'warm up' });
    const startedAt = performance.now();
    await persistAskInteraction({ ...interaction, question });
    expect(performance.now() - startedAt).toBeLessThan(PERSIST_TIME_BOUND_MS);
  });

  it.each([
    ['a plain local part', 'jane.doe'],
    ['a plus-tagged local part', 'jane+news'],
  ])('never stores a partial address that crosses the cut: %s', async (_label, local) => {
    const address = `${local}@example.com`;
    const lead = 'x '.repeat((LOGGED_QUESTION_CHARS - 6) / 2);
    const question = `${lead}${address} trailing words`;
    expect(question.indexOf(address)).toBeLessThan(LOGGED_QUESTION_CHARS);
    expect(question.indexOf(address) + address.length).toBeGreaterThan(LOGGED_QUESTION_CHARS);

    const stored = await storedQuestion(question);

    expect(stored).not.toContain(local.slice(0, 3));
    expect(stored.endsWith(EMAIL_PLACEHOLDER.slice(0, LOGGED_QUESTION_CHARS - lead.length))).toBe(
      true,
    );
  });
});
