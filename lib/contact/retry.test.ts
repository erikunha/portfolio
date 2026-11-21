import { describe, expect, it, vi } from 'vitest';
import { CONTACT_MAX_RETRY_ATTEMPTS, type ContactMessage } from './outbox';
import { type RetryDeps, retryPendingContacts } from './retry';

const NOW_MS = Date.parse('2026-10-24T04:00:00.000Z');
const FRESH_RECEIVED_AT = '2026-10-24T00:00:00.000Z';
const EXPIRED_RECEIVED_AT = '2026-10-22T00:00:00.000Z';
const REQUEST_ID = 'retry-run';
const DEADLINE_MS = 40_000;

const stored = (receivedAt: string): ContactMessage => ({
  name: 'Visitor',
  email: 'visitor@example.com',
  message: 'Hello',
  receivedAt,
});

function makeDeps(overrides: Partial<RetryDeps> = {}): RetryDeps {
  return {
    requestId: REQUEST_ID,
    getPendingIds: vi.fn().mockResolvedValue(['a']),
    getMessage: vi.fn().mockResolvedValue(stored(FRESH_RECEIVED_AT)),
    getAttempts: vi.fn().mockResolvedValue(0),
    incrementAttempts: vi.fn().mockResolvedValue(1),
    removePending: vi.fn().mockResolvedValue(undefined),
    deliver: vi.fn().mockResolvedValue(true),
    log: { warn: vi.fn(), error: vi.fn() },
    ...overrides,
  };
}

const counts = (sent = 0, failed = 0, expired = 0, exhausted = 0) => ({
  sent,
  failed,
  expired,
  exhausted,
});

describe('retryPendingContacts', () => {
  it('delivers a pending message and removes it from the outbox', async () => {
    const deps = makeDeps();
    expect(await retryPendingContacts(() => NOW_MS, deps)).toEqual(counts(1));
    expect(deps.deliver).toHaveBeenCalledWith('a', stored(FRESH_RECEIVED_AT), REQUEST_ID);
    expect(deps.removePending).toHaveBeenCalledWith('a');
  });

  it('keeps the message pending and counts a failure when delivery fails', async () => {
    const deps = makeDeps({ deliver: vi.fn().mockResolvedValue(false) });
    expect(await retryPendingContacts(() => NOW_MS, deps)).toEqual(counts(0, 1));
    expect(deps.removePending).not.toHaveBeenCalled();
  });

  it('drops a message that is missing from storage as expired', async () => {
    const deps = makeDeps({ getMessage: vi.fn().mockResolvedValue(null) });
    expect(await retryPendingContacts(() => NOW_MS, deps)).toEqual(counts(0, 0, 1));
    expect(deps.removePending).toHaveBeenCalledWith('a');
    expect(deps.log.warn).toHaveBeenCalledWith('contact retry dropped', {
      requestId: REQUEST_ID,
      msgId: 'a',
      reason: 'expired',
    });
    expect(deps.deliver).not.toHaveBeenCalled();
  });

  it('drops a message older than the retry window without delivering', async () => {
    const deps = makeDeps({
      getMessage: vi.fn().mockResolvedValue(stored(EXPIRED_RECEIVED_AT)),
    });
    expect(await retryPendingContacts(() => NOW_MS, deps)).toEqual(counts(0, 0, 1));
    expect(deps.deliver).not.toHaveBeenCalled();
  });

  it('drops a message whose recorded attempts already reached the cap', async () => {
    const deps = makeDeps({
      getAttempts: vi.fn().mockResolvedValue(CONTACT_MAX_RETRY_ATTEMPTS),
    });
    expect(await retryPendingContacts(() => NOW_MS, deps)).toEqual(counts(0, 0, 0, 1));
    expect(deps.incrementAttempts).not.toHaveBeenCalled();
    expect(deps.deliver).not.toHaveBeenCalled();
  });

  it('drops a message whose increment passes the cap', async () => {
    const deps = makeDeps({
      incrementAttempts: vi.fn().mockResolvedValue(CONTACT_MAX_RETRY_ATTEMPTS + 1),
    });
    expect(await retryPendingContacts(() => NOW_MS, deps)).toEqual(counts(0, 0, 0, 1));
    expect(deps.log.warn).toHaveBeenCalledWith('contact retry dropped', {
      requestId: REQUEST_ID,
      msgId: 'a',
      reason: 'exhausted',
    });
    expect(deps.deliver).not.toHaveBeenCalled();
  });

  it('counts a failure and carries on when one message throws', async () => {
    const deps = makeDeps({
      getPendingIds: vi.fn().mockResolvedValue(['a', 'b']),
      getMessage: vi
        .fn()
        .mockRejectedValueOnce(new Error('redis down'))
        .mockResolvedValueOnce(stored(FRESH_RECEIVED_AT)),
    });
    expect(await retryPendingContacts(() => NOW_MS, deps)).toEqual(counts(1, 1));
    expect(deps.log.error).toHaveBeenCalledWith('contact retry failed', {
      requestId: REQUEST_ID,
      msgId: 'a',
    });
  });

  it('stops starting new sends once the start deadline passes and logs what remains', async () => {
    let clock = NOW_MS;
    const deps = makeDeps({
      getPendingIds: vi.fn().mockResolvedValue(['a', 'b', 'c']),
      deliver: vi.fn().mockImplementation(async () => {
        clock += DEADLINE_MS;
        return true;
      }),
    });
    expect(await retryPendingContacts(() => clock, deps)).toEqual(counts(1));
    expect(deps.deliver).toHaveBeenCalledOnce();
    expect(deps.log.warn).toHaveBeenCalledWith('contact retry deadline reached', {
      requestId: REQUEST_ID,
      remaining: 2,
    });
  });

  it('keeps starting sends while the elapsed time stays under the start deadline', async () => {
    let clock = NOW_MS;
    const deps = makeDeps({
      getPendingIds: vi.fn().mockResolvedValue(['a', 'b']),
      deliver: vi.fn().mockImplementation(async () => {
        clock += DEADLINE_MS - 1;
        return true;
      }),
    });
    expect(await retryPendingContacts(() => clock, deps)).toEqual(counts(2));
    expect(deps.log.warn).not.toHaveBeenCalled();
  });
});
