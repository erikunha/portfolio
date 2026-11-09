import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';
import { askRequest, readBody } from './helpers/ask-route';

const streamTextCalls: Record<string, unknown>[] = [];

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: (options: Record<string, unknown>) => {
      streamTextCalls.push(options);
      return actual.streamText(options as never);
    },
  };
});

vi.mock('@/lib/rate-limit', async () => (await import('./helpers/ask-route')).rateLimitModule());

vi.mock('@/lib/ask-log', async () => (await import('./helpers/ask-route')).askLogModule());

vi.mock('@/lib/ip-hash', async () => (await import('./helpers/ask-route')).ipHashModule());

vi.mock('@/lib/log', async () => (await import('./helpers/ask-route')).logModule());

const GATEWAY_REJECTED_STATUS = 400;

type WirePart = { type: string; text?: string };

type WireMessage = {
  role: string;
  content: string | WirePart[];
  providerOptions?: { anthropic?: { cacheControl?: { type?: string } } };
};

function textOf(content: WireMessage['content']): string {
  if (typeof content === 'string') return content;
  return content.map((part) => part.text ?? '').join('');
}

describe('/api/ask system prompt cache marker', () => {
  const realFetch = globalThis.fetch;
  const gatewayBodies: { prompt: WireMessage[] }[] = [];

  beforeEach(() => {
    process.env.ASK_ENABLED = 'true';
    process.env.AI_GATEWAY_API_KEY = 'test-gateway-key';
    streamTextCalls.length = 0;
    gatewayBodies.length = 0;
    vi.resetModules();
    globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      gatewayBodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ error: { message: 'rejected', type: 'test' } }), {
        status: GATEWAY_REJECTED_STATUS,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.AI_GATEWAY_API_KEY;
  });

  it('hands the system prompt to the SDK as instructions, never as a message', async () => {
    const { POST } = await import('@/app/api/ask/route');
    await readBody(await POST(askRequest({ question: 'What is your stack?' })));

    const options = streamTextCalls[0] as {
      instructions?: { role: string; content: string; providerOptions?: unknown };
      messages: { role: string }[];
      allowSystemInMessages?: boolean;
    };
    expect(options.instructions).toEqual({
      role: 'system',
      content: SYSTEM_TEXT,
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    });
    expect(
      options.messages.map((m) => m.role),
      'the system prompt must ride in instructions, not in messages',
    ).toEqual(['user']);
    expect(options.allowSystemInMessages, 'the SDK system-message guard stays on').toBeUndefined();
  });

  it('still sends the ephemeral cache marker on the system block in the gateway request body', async () => {
    const { POST } = await import('@/app/api/ask/route');
    await readBody(await POST(askRequest({ question: 'What is your stack?' })));

    expect(gatewayBodies, 'the gateway received no request').not.toHaveLength(0);
    const prompt = gatewayBodies[0]?.prompt ?? [];
    const system = prompt.filter((message) => message.role === 'system');
    expect(system, 'exactly one system block reaches the provider request').toHaveLength(1);
    expect(textOf(system[0]?.content ?? '')).toBe(SYSTEM_TEXT);
    expect(
      system[0]?.providerOptions?.anthropic?.cacheControl?.type,
      'without cacheControl on the system block every request pays full input price',
    ).toBe('ephemeral');
    expect(
      prompt[0]?.role,
      'the system block leads the prompt so the cached prefix is stable',
    ).toBe('system');
  });
});
