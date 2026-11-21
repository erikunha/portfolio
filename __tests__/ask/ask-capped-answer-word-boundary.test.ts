import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askErrors } from '@/content/ask-errors';
import { MAX_ANSWER_CHARS } from '@/lib/ask/output-guard';
import { askRequest, readBody } from '../helpers/ask-route';

const mockStreamText = vi.fn();

vi.mock('ai', () => ({ streamText: mockStreamText }));

vi.mock('@/lib/server/client-ip', async () =>
  (await import('../helpers/ask-route')).clientIpModule(),
);
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/ask-route')).rateLimitModule());
vi.mock('@/lib/ask/budget', async () => (await import('../helpers/ask-route')).budgetModule());
vi.mock('@/lib/ask/dedup', async () => (await import('../helpers/ask-route')).dedupModule());
vi.mock('@/lib/ask/interaction-log', async () =>
  (await import('../helpers/ask-route')).askLogModule(),
);
vi.mock('@/lib/ip-hash', async () => (await import('../helpers/ask-route')).ipHashModule());
vi.mock('@/lib/log', async () => (await import('../helpers/ask-route')).logModule());

function modelStream(deltas: string[], finishReason: string) {
  return {
    textStream: {
      async *[Symbol.asyncIterator]() {
        for (const delta of deltas) yield delta;
      },
    },
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 512 }),
    finishReason: Promise.resolve(finishReason),
  };
}

function request(locale: 'en' | 'pt'): NextRequest {
  return askRequest(
    { question: 'Give me everything about Erik', locale },
    { headers: { 'x-site-locale': locale } },
  );
}

async function answerBody(deltas: string[], finishReason: string, locale: 'en' | 'pt' = 'en') {
  mockStreamText.mockReturnValueOnce(modelStream(deltas, finishReason));
  const { POST } = await import('@/app/api/ask/route');
  const res = await POST(request(locale));
  expect(res.status).toBe(200);
  return readBody(res);
}

describe('/api/ask: a capped answer ends on a whole word before the notice', () => {
  beforeEach(() => {
    vi.stubEnv('ASK_ENABLED', 'true');
    vi.resetModules();
    mockStreamText.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(['en', 'pt'] as const)(
    'drops the partial word the output-token cap cut, then appends the %s notice',
    async (locale) => {
      const notice = askErrors[locale].truncation;
      const body = await answerBody(['Erik shipped a governed L'], 'length', locale);

      expect(body.endsWith(notice)).toBe(true);
      expect(body.slice(0, -notice.length).trimEnd()).toBe('Erik shipped a governed');
    },
  );

  it('drops the partial word when the cut falls across token-sized deltas', async () => {
    const notice = askErrors.en.truncation;
    const body = await answerBody(['Erik shipped a gover', 'ned LL', 'M gate'], 'length');

    expect(body.slice(0, -notice.length).trimEnd()).toBe('Erik shipped a governed LLM');
  });

  it('keeps the whole answer, final word included, on a normal finish', async () => {
    const body = await answerBody(['Erik works at ', 'Ray', 'lu'], 'stop');

    expect(body).toBe('Erik works at Raylu');
  });

  it('ends a guard-length abort on a whole word and keeps the cap a hard bound', async () => {
    const { parseStreamChunk } = await import('@/lib/stream-protocol');
    const wholeWords = 'word '.repeat(Math.floor((MAX_ANSWER_CHARS - 50) / 5));
    const body = await answerBody([`${wholeWords}parti`, `al ${'x'.repeat(100)}`], 'stop');

    const parsed = parseStreamChunk(body);
    expect(parsed.ok).toBe(false);
    expect(parsed.displayText.endsWith('word')).toBe(true);
    expect(parsed.displayText.length).toBeLessThanOrEqual(MAX_ANSWER_CHARS);
  });

  it('never emits more than the model produced when nothing was cut', async () => {
    const { parseStreamChunk } = await import('@/lib/stream-protocol');
    const body = await answerBody(['one two ', 'three'], 'stop');

    expect(parseStreamChunk(body)).toEqual({ ok: true, displayText: 'one two three' });
  });
});
