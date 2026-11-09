import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ASK_MAX_QUESTION_CHARS } from '@/lib/ask/limits';
import { askRequest } from './helpers/ask-route';

const afterMock = vi.hoisted(() => vi.fn());
const streamTextMock = vi.hoisted(() => vi.fn());
const redisSet = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => 'OK'));

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: afterMock,
}));
vi.mock('ai', () => ({ streamText: streamTextMock }));
vi.mock('@/lib/rate-limit', async () =>
  (await import('./helpers/ask-route')).rateLimitModule({
    hasRedisCredentials: vi.fn(() => true),
    getRedis: vi.fn(() => ({ set: redisSet })),
    reserveBudget: vi.fn(async () => ({
      allowed: true,
      reserved: 2712,
      pct: 0,
      budgetKey: 'ask:tokens:test',
      dailyKey: 'ask:tokens:day:test',
    })),
  }),
);
vi.mock('@/lib/ip-hash', async () => (await import('./helpers/ask-route')).ipHashModule());
vi.mock('@/lib/log', async () => (await import('./helpers/ask-route')).logModule());

const ANSWER_LOG_CHARS = 1000;
const FILLER = 'q';

const STRADDLING_PII = [
  ['an email', 'jane.doe@example.com', 'jane'],
  ['a phone number', '11 99999-9999', '99999'],
] as const;

function request(question: string): NextRequest {
  return askRequest({ question });
}

function answering(answer: string): void {
  streamTextMock.mockReturnValue({
    textStream: (async function* () {
      yield answer;
    })(),
    usage: Promise.resolve({ inputTokens: 2000, outputTokens: 40, inputTokenDetails: {} }),
    finishReason: Promise.resolve('stop'),
  });
}

async function storedRecord(question: string): Promise<{ question: string; answer: string }> {
  const { POST } = await import('@/app/api/ask/route');
  await (await POST(request(question))).text();
  const [task] = afterMock.mock.calls[0] as [() => Promise<void>];
  await task();
  const [, value] = redisSet.mock.calls[0] ?? [];
  return JSON.parse(String(value)) as { question: string; answer: string };
}

describe('/api/ask log redaction at the truncation boundary', () => {
  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    vi.resetModules();
    afterMock.mockReset();
    redisSet.mockClear();
    streamTextMock.mockReset();
    answering('Erik builds web applications.');
  });

  it.each(STRADDLING_PII)(
    'does not store the head of %s that straddles the question cut',
    async (_label, pii, head) => {
      const padding = FILLER.repeat(ASK_MAX_QUESTION_CHARS - 10);
      const question = `${padding} ${pii} and more text after it`;
      expect(question.indexOf(pii)).toBeLessThan(ASK_MAX_QUESTION_CHARS);
      expect(question.indexOf(pii) + pii.length).toBeGreaterThan(ASK_MAX_QUESTION_CHARS);

      const record = await storedRecord(question);

      expect(
        record.question,
        'redaction ran after the 500 character cut, so a cut identifier no longer matched its pattern and persisted',
      ).not.toContain(head);
    },
  );

  it.each(STRADDLING_PII)(
    'does not store the head of %s that straddles the answer cut',
    async (_label, pii, head) => {
      const padding = FILLER.repeat(ANSWER_LOG_CHARS - 11);
      const answer = `${padding} ${pii} and more text after it`;
      expect(answer.indexOf(pii)).toBeLessThan(ANSWER_LOG_CHARS);
      expect(answer.indexOf(pii) + pii.length).toBeGreaterThan(ANSWER_LOG_CHARS);
      answering(answer);

      const record = await storedRecord('Who is Erik?');

      expect(record.answer).not.toContain(head);
    },
  );

  it('still sends the model the question cut to the length limit', async () => {
    const { POST } = await import('@/app/api/ask/route');
    await (await POST(request(FILLER.repeat(ASK_MAX_QUESTION_CHARS + 200)))).text();

    const args = streamTextMock.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const userTurn = args.messages.find((m) => m.role === 'user')?.content ?? '';
    expect(userTurn).toContain(FILLER.repeat(ASK_MAX_QUESTION_CHARS));
    expect(userTurn).not.toContain(FILLER.repeat(ASK_MAX_QUESTION_CHARS + 1));
  });
});
