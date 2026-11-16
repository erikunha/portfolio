import { beforeEach, describe, expect, it, vi } from 'vitest';

const set = vi.fn();
const del = vi.fn();
vi.mock('@/lib/redis', () => ({ getRedis: () => ({ set, del }) }));

const payload = {
  name: 'Ada',
  email: 'ada@example.com',
  message: 'hello',
  receivedAt: '2026-10-24T02:00:00.000Z',
};
const NINETY_DAYS_SECONDS = 60 * 60 * 24 * 90;

describe('contact message persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    set.mockResolvedValue('OK');
    del.mockResolvedValue(1);
  });

  it('stores the serialized payload under the message key with the retention TTL', async () => {
    const { saveContactMessage } = await import('./outbox');
    await saveContactMessage('msg-1', payload);
    expect(set).toHaveBeenCalledWith('contact:msg:msg-1', JSON.stringify(payload), {
      ex: NINETY_DAYS_SECONDS,
    });
  });

  it('deletes the message key', async () => {
    const { deleteContactMessage } = await import('./outbox');
    await deleteContactMessage('msg-1');
    expect(del).toHaveBeenCalledWith('contact:msg:msg-1');
  });

  it('propagates storage errors from save and delete', async () => {
    const { saveContactMessage, deleteContactMessage } = await import('./outbox');
    set.mockRejectedValueOnce(new Error('kv down'));
    del.mockRejectedValueOnce(new Error('kv down'));
    await expect(saveContactMessage('msg-1', payload)).rejects.toThrow('kv down');
    await expect(deleteContactMessage('msg-1')).rejects.toThrow('kv down');
  });
});
