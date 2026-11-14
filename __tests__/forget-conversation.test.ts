import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askRequest } from './helpers/ask-route';

const TARGET = '11111111-2222-4333-8444-555555555555';
const SIBLING = '22222222-3333-4444-8555-666666666666';
const CONVERSATION = '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b';
const TARGET_KEY = `ask:log:2026-11-12:${TARGET}`;
const SIBLING_KEY = `ask:log:2026-11-10:${SIBLING}`;
const INDEX_KEY = `ask:conv:${CONVERSATION}`;
const NOW = new Date('2026-11-13T12:00:00.000Z');

const del = vi.fn();
const mget = vi.fn();
const smembers = vi.fn();
const logInfo = vi.fn();
const removePendingContact = vi.fn();

function record(conversationId?: unknown) {
  return {
    requestId: TARGET,
    ts: '2026-11-12T10:00:00.000Z',
    question: 'q',
    answer: 'a',
    ...(conversationId === undefined ? {} : { conversationId }),
  };
}

function storedAt(key: string, value: unknown) {
  mget.mockImplementation(async (...keys: string[]) =>
    keys.map((candidate) => (candidate === key ? value : null)),
  );
}

async function forget(requestId: string): Promise<Response> {
  const { POST } = await import('@/app/api/log/forget/route');
  return POST(askRequest({ requestId }, { url: 'http://localhost/api/log/forget' }));
}

const deletedKeys = () => del.mock.calls.flat().map(String);

describe('/api/log/forget deletes the whole conversation of the id it is given', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    for (const fn of [del, mget, smembers, logInfo, removePendingContact]) fn.mockReset();
    del.mockResolvedValue(3);
    mget.mockResolvedValue([]);
    smembers.mockResolvedValue([]);
    vi.doMock('@/lib/rate-limit', () => ({
      getClientIp: vi.fn(() => '127.0.0.1'),
      getForgetLimit: vi.fn(() => ({ limit: vi.fn(async () => ({ success: true })) })),
      getRedis: vi.fn(() => ({ del, mget, smembers })),
    }));
    vi.doMock('@/lib/contact-outbox', () => ({
      contactMessageKey: (id: string) => `contact:msg:${id}`,
      removePendingContact,
    }));
    vi.doMock('@/lib/ip-hash', () => ({ hashIp: vi.fn(async () => 'hashed-ip-test') }));
    vi.doMock('@/lib/log', () => ({
      log: { info: logInfo, error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.doUnmock('@/lib/rate-limit');
    vi.doUnmock('@/lib/contact-outbox');
    vi.doUnmock('@/lib/ip-hash');
    vi.doUnmock('@/lib/log');
  });

  it('given any one request id, deletes every log key of its conversation and the index', async () => {
    storedAt(TARGET_KEY, record(CONVERSATION));
    smembers.mockResolvedValue([TARGET_KEY, SIBLING_KEY]);

    const res = await forget(TARGET);

    expect(res.status).toBe(200);
    expect(smembers).toHaveBeenCalledWith(INDEX_KEY);
    expect(deletedKeys()).toEqual(
      expect.arrayContaining([TARGET_KEY, SIBLING_KEY, INDEX_KEY, `contact:msg:${TARGET}`]),
    );
    expect(removePendingContact).toHaveBeenCalledWith(TARGET);
  });

  it('reads a record the store hands back as a JSON string', async () => {
    storedAt(TARGET_KEY, JSON.stringify(record(CONVERSATION)));
    smembers.mockResolvedValue([SIBLING_KEY]);
    await forget(TARGET);
    expect(deletedKeys()).toEqual(expect.arrayContaining([SIBLING_KEY, INDEX_KEY]));
  });

  it('looks the record up across every date the TTL still keeps', async () => {
    await forget(TARGET);
    const looked = mget.mock.calls.flat().map(String);
    expect(looked).toContain(`ask:log:2026-11-13:${TARGET}`);
    expect(looked).toContain(`ask:log:2026-08-15:${TARGET}`);
  });

  it('deletes only its own keys for a legacy record with no conversation id', async () => {
    storedAt(TARGET_KEY, record());
    await forget(TARGET);
    expect(smembers).not.toHaveBeenCalled();
    expect(deletedKeys()).toContain(TARGET_KEY);
    expect(deletedKeys().some((key) => key.startsWith('ask:conv:'))).toBe(false);
  });

  it('ignores a stored conversation id that is not a uuid', async () => {
    storedAt(TARGET_KEY, record('ask:log:*'));
    await forget(TARGET);
    expect(smembers).not.toHaveBeenCalled();
  });

  it('never deletes an index member outside the ask log key space', async () => {
    storedAt(TARGET_KEY, record(CONVERSATION));
    smembers.mockResolvedValue([SIBLING_KEY, 'contact:outbox', 'ask:budget:2026-11']);
    await forget(TARGET);
    expect(deletedKeys()).toContain(SIBLING_KEY);
    expect(deletedKeys()).not.toContain('contact:outbox');
    expect(deletedKeys()).not.toContain('ask:budget:2026-11');
  });

  it('answers 503 and deletes nothing when the lookup fails', async () => {
    mget.mockRejectedValue(new Error('Upstash down'));
    const res = await forget(TARGET);
    expect(res.status).toBe(503);
    expect(del).not.toHaveBeenCalled();
  });

  it('answers 503 when the conversation index cannot be read, so it never claims a partial delete', async () => {
    storedAt(TARGET_KEY, record(CONVERSATION));
    smembers.mockRejectedValue(new Error('Upstash down'));
    const res = await forget(TARGET);
    expect(res.status).toBe(503);
    expect(del).not.toHaveBeenCalled();
  });

  it('answers the same envelope whether or not the id had a conversation and logs no conversation id', async () => {
    storedAt(TARGET_KEY, record(CONVERSATION));
    smembers.mockResolvedValue([TARGET_KEY]);
    const withConversation = await (await forget(TARGET)).json();
    mget.mockResolvedValue([]);
    const unknown = await (await forget(SIBLING)).json();
    expect(Object.keys(withConversation).sort()).toEqual(Object.keys(unknown).sort());
    for (const call of logInfo.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(CONVERSATION);
    }
  });

  it('keeps the smoke uuid path free of any store call', async () => {
    const res = await forget('00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(200);
    expect(mget).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });
});
