// @vitest-environment node

import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askRequest } from './helpers/ask-route';

const streamTextMock = vi.fn(() => ({
  textStream: (async function* () {
    yield 'Erik builds web applications.';
  })(),
  usage: Promise.resolve({ inputTokens: 120, outputTokens: 80 }),
}));

vi.mock('ai', () => ({ streamText: streamTextMock }));
vi.mock('@/lib/env', () => ({ env: { ASK_ENABLED: 'true' } }));
vi.mock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'test-ip-hash') }));
vi.mock('@/lib/ask-log', async () => (await import('./helpers/ask-route')).askLogModule());
vi.mock('@/lib/log', async () => (await import('./helpers/ask-route')).logModule());

const UNREACHABLE = 'Failed to parse URL from /pipeline';
const redisCall = vi.fn(async (): Promise<never> => {
  throw new Error(UNREACHABLE);
});

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => ({
      get: redisCall,
      set: redisCall,
      decrby: redisCall,
      pipeline: () => ({ incrby: vi.fn(), expire: vi.fn(), exec: redisCall }),
    }),
  },
}));
vi.mock('@upstash/ratelimit', () => {
  function Ratelimit() {
    return { limit: redisCall };
  }
  Ratelimit.slidingWindow = () => ({});
  return { Ratelimit };
});

const RUN_REQUESTS = 4;
const BUDGET_EXHAUSTED = 503;

function variantRequest(index: number): NextRequest {
  return askRequest(
    { question: `What does Erik build, variant ${index}?` },
    { headers: { 'x-forwarded-for': `10.0.0.${index + 1}` } },
  );
}

describe('ask route under the eval harness budget store', () => {
  beforeEach(() => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.test');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects every request with 503 when Redis is unreachable and no store is installed', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const response = await POST(variantRequest(0));
    expect(response.status).toBe(BUDGET_EXHAUSTED);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it('answers a full corpus-sized run with Redis unreachable', async () => {
    const { createEvalBudgetStore, setBudgetStore } = await import('@/lib/rate-limit');
    setBudgetStore(createEvalBudgetStore(RUN_REQUESTS));
    const { POST } = await import('@/app/api/ask/route');

    for (let i = 0; i < RUN_REQUESTS; i += 1) {
      const response = await POST(variantRequest(i));
      expect(response.status).toBe(200);
      await response.text();
    }
    expect(streamTextMock).toHaveBeenCalledTimes(RUN_REQUESTS);
  });

  it('holds the run bound against the route reservation even when no completion settles', async () => {
    const { createEvalBudgetStore, setBudgetStore } = await import('@/lib/rate-limit');
    setBudgetStore(createEvalBudgetStore(RUN_REQUESTS));
    streamTextMock.mockImplementation(() => ({
      textStream: (async function* () {
        yield 'x';
      })(),
      usage: Promise.resolve({ inputTokens: 1_000_000, outputTokens: 1_000_000 }),
    }));
    const { POST } = await import('@/app/api/ask/route');

    for (let i = 0; i < RUN_REQUESTS; i += 1) {
      const response = await POST(variantRequest(i));
      expect(response.status).toBe(200);
      await response.text();
    }
    const over = await POST(variantRequest(RUN_REQUESTS));
    expect(over.status).toBe(BUDGET_EXHAUSTED);
  });
});
