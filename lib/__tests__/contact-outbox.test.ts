import { beforeEach, describe, expect, it, vi } from 'vitest';

const transaction = { hset: vi.fn(), zadd: vi.fn(), zrem: vi.fn(), hdel: vi.fn(), exec: vi.fn() };
const redis = {
  multi: () => transaction,
  zrange: vi.fn(),
  get: vi.fn(),
  hget: vi.fn(),
  hincrby: vi.fn(),
};
vi.mock('@/lib/rate-limit', () => ({ getRedis: () => redis }));

describe('contact outbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.exec.mockResolvedValue([1, 1]);
  });

  it('atomically queues an id ordered by receivedAt with zero retry attempts', async () => {
    const { enqueueContact } = await import('@/lib/contact-outbox');
    await enqueueContact('message-id', '2026-10-24T02:00:00.000Z');
    expect(transaction.zadd).toHaveBeenCalledWith('contact:outbox', {
      score: Date.parse('2026-10-24T02:00:00.000Z'),
      member: 'message-id',
    });
    expect(transaction.hset).toHaveBeenCalledWith('contact:outbox:attempts', { 'message-id': 0 });
    expect(transaction.exec).toHaveBeenCalledOnce();
  });

  it('reads all pending ids from the sorted set in ascending receivedAt order', async () => {
    redis.zrange.mockResolvedValueOnce(['older', 'newer']);
    const { getPendingContactIds } = await import('@/lib/contact-outbox');
    expect(await getPendingContactIds()).toEqual(['older', 'newer']);
    expect(redis.zrange).toHaveBeenCalledWith('contact:outbox', 0, -1);
  });

  it('reads stored message objects through the Redis automatic JSON decoder', async () => {
    const stored = {
      name: 'Visitor',
      email: 'visitor@example.com',
      message: 'Private message',
      receivedAt: '2026-10-24T02:00:00.000Z',
      ipHash: 'hash',
    };
    redis.get.mockResolvedValueOnce(stored);
    const { getContactMessage } = await import('@/lib/contact-outbox');
    expect(await getContactMessage('message-id')).toEqual(stored);
    expect(redis.get).toHaveBeenCalledWith('contact:msg:message-id');
  });

  it('defaults a missing retry counter to zero and increments atomically', async () => {
    redis.hget.mockResolvedValueOnce(null);
    redis.hincrby.mockResolvedValueOnce(1);
    const { getContactAttempts, incrementContactAttempts } = await import('@/lib/contact-outbox');
    expect(await getContactAttempts('message-id')).toBe(0);
    expect(await incrementContactAttempts('message-id')).toBe(1);
    expect(redis.hincrby).toHaveBeenCalledWith('contact:outbox:attempts', 'message-id', 1);
  });

  it('removes only pending membership and attempt count, preserving the audit message', async () => {
    const { removePendingContact } = await import('@/lib/contact-outbox');
    await removePendingContact('message-id');
    expect(transaction.zrem).toHaveBeenCalledWith('contact:outbox', 'message-id');
    expect(transaction.hdel).toHaveBeenCalledWith('contact:outbox:attempts', 'message-id');
    expect(transaction.exec).toHaveBeenCalledOnce();
  });
});
