import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askRequest } from './helpers/ask-route';

const TARGET = '11111111-2222-4333-8444-555555555555';
const CONVERSATION = '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b';
const INDEX_KEY = `ask:conv:${CONVERSATION}`;
const NOW = new Date('2026-11-13T12:00:00.000Z');

const strings = new Map<string, unknown>();
const sets = new Map<string, Set<string>>();

const store = {
  get: vi.fn(async (key: string) => strings.get(key) ?? null),
  set: vi.fn(async (key: string, value: unknown) => {
    strings.set(key, value);
    return 'OK';
  }),
  mget: vi.fn(async (...keys: string[]) =>
    keys.map((key) => {
      const raw = strings.get(key);
      return typeof raw === 'string' ? JSON.parse(raw) : (raw ?? null);
    }),
  ),
  smembers: vi.fn(async (key: string) => [...(sets.get(key) ?? [])]),
  srem: vi.fn(async (key: string, ...members: string[]) => {
    for (const m of members) sets.get(key)?.delete(m);
    return members.length;
  }),
  del: vi.fn(async (...keys: string[]) => {
    for (const key of keys) {
      strings.delete(key);
      sets.delete(key);
    }
    return keys.length;
  }),
  multi: () => {
    const ops: Array<() => void> = [];
    const tx = {
      set: (key: string, value: unknown) => {
        ops.push(() => strings.set(key, value));
        return tx;
      },
      sadd: (key: string, member: string) => {
        ops.push(() => {
          const set = sets.get(key) ?? new Set<string>();
          set.add(member);
          sets.set(key, set);
        });
        return tx;
      },
      expire: () => tx,
      exec: async () => {
        for (const op of ops) op();
        return [];
      },
    };
    return tx;
  },
};

function interaction(conversationId: string) {
  return {
    requestId: TARGET,
    ts: '2026-11-13T10:00:00.000Z',
    ipHash: 'h',
    question: 'q',
    answer: 'a',
    inputTokens: 1,
    outputTokens: 1,
    durationMs: 1,
    status: 'completed' as const,
    conversationId,
  };
}

function leftovers(): string[] {
  return [...strings.keys(), ...[...sets.values()].flatMap((set) => [...set])].filter(
    (key) => key.startsWith('ask:log:') || key.startsWith('ask:conv:'),
  );
}

describe('forget then persist for the same request', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    strings.clear();
    sets.clear();
    vi.doMock('server-only', () => ({}));
    vi.doMock('@/lib/rate-limit', () => ({
      getClientIp: vi.fn(() => '127.0.0.1'),
      getForgetLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
      getRedis: vi.fn(() => store),
    }));
    vi.doMock('@/lib/contact-outbox', () => ({
      contactMessageKey: (id: string) => `contact:msg:${id}`,
      removePendingContact: vi.fn(async () => undefined),
    }));
    vi.doMock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed-ip-test') }));
    vi.doMock('@/lib/log', () => ({
      log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));
  });

  it('leaves no row and no index member when the forget lands before the write', async () => {
    const { POST } = await import('@/app/api/log/forget/route');
    const { persistAskInteraction } = await import('@/lib/ask-log');

    const res = await POST(
      askRequest({ requestId: TARGET }, { url: 'http://localhost/api/log/forget' }),
    );
    await persistAskInteraction(interaction(CONVERSATION));

    expect(res.status).toBe(200);
    expect(leftovers()).toEqual([]);
    expect(sets.get(INDEX_KEY)?.size ?? 0).toBe(0);
  });

  it('still persists a request nobody forgot', async () => {
    const { persistAskInteraction } = await import('@/lib/ask-log');
    await persistAskInteraction(interaction(CONVERSATION));
    expect(leftovers().length).toBeGreaterThan(0);
  });
});
