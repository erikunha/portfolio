// lib/ask/__tests__/model.test.ts
// WS1: ASK_MODEL is the single source of truth for the /api/ask feature model.
//
// Two contracts:
//  1. Behavioral — the value POST /api/ask passes to streamText IS ASK_MODEL.
//     Catches route.ts drifting back to a local literal.
//  2. No-drift — the raw model literal exists in exactly one source location
//     (lib/ask/model.ts), so route.ts and the eval harness can never grade a
//     different model than ships.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASK_MODEL } from '@/lib/ask/model';

const mockStreamText = vi.fn();

vi.mock('ai', () => ({ streamText: mockStreamText }));

function makeStreamTextResult(text = 'ok') {
  return {
    textStream: {
      async *[Symbol.asyncIterator]() {
        yield text;
      },
    },
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 1 }),
    providerMetadata: Promise.resolve({
      anthropic: { cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    }),
  };
}

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
  getAskLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
  reserveBudget: vi.fn(async () => ({
    allowed: true,
    reserved: 1512,
    pct: 0,
    budgetKey: 'ask:tokens:test',
  })),
  settleBudget: vi.fn(async () => undefined),
  checkIdenticalQuestion: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('@/lib/ask-log', () => ({ persistAskInteraction: vi.fn(async () => undefined) }));
vi.mock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed-ip-test') }));
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function makeRequest(question = 'Who is Erik?'): NextRequest {
  return new NextRequest('http://localhost/api/ask', {
    method: 'POST',
    body: JSON.stringify({ question }),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function drain(res: Response): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) return;
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
}

beforeEach(() => {
  vi.resetModules();
  mockStreamText.mockReset().mockReturnValue(makeStreamTextResult());
  // Hermetic: importing the route loads lib/env.ts, which validates managed
  // vars at module load (e.g. UPSTASH_REDIS_REST_URL format). Clear them so a
  // stray/malformed ambient value can't fail this test for unrelated reasons.
  for (const key of [
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'AI_GATEWAY_API_KEY',
    'RESEND_API_KEY',
    'PSI_API_KEY',
    'CRON_SECRET',
    'DEPLOY_SALT',
  ]) {
    vi.stubEnv(key, undefined as unknown as string);
  }
  vi.stubEnv('ASK_ENABLED', 'true');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('ASK_MODEL — single source of truth', () => {
  it('is the exact model string POST /api/ask hands to streamText', async () => {
    const { POST } = await import('@/app/api/ask/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockStreamText).toHaveBeenCalledOnce();
    const arg = mockStreamText.mock.calls[0]?.[0] as { model: string };
    expect(arg.model).toBe(ASK_MODEL);
    await drain(res);
  });

  it('exposes a non-empty provider/model string', () => {
    expect(ASK_MODEL).toMatch(/^[a-z0-9-]+\/[a-z0-9.-]+$/);
  });

  it('the raw model literal lives in exactly one source location', () => {
    // behavioral-test-allow: WS1 no-drift invariant — the model literal must
    // exist in a single source file so route.ts and the eval harness import it.
    const files = ['app/api/ask/route.ts', 'scripts/ask-eval.ts', 'lib/ask/model.ts'];
    const literal = `'${ASK_MODEL}'`;
    const hits = files.filter((f) =>
      readFileSync(join(process.cwd(), f), 'utf8').includes(literal),
    );
    expect(hits).toEqual(['lib/ask/model.ts']);
  });
});
