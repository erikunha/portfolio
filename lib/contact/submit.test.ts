import { describe, expect, it, vi } from 'vitest';
import { type SubmitDeps, type SubmitInput, submitContact } from './submit';

const NOW_MS = Date.parse('2026-10-24T02:00:00.000Z');
const RECEIVED_AT = '2026-10-24T02:00:00.000Z';

const input: SubmitInput = {
  msgId: 'req-1',
  requestId: 'req-1',
  name: 'Visitor',
  email: 'visitor@example.com',
  message: 'Hello',
  ipHash: 'hash',
};

const savedPayload = {
  name: 'Visitor',
  email: 'visitor@example.com',
  message: 'Hello',
  receivedAt: RECEIVED_AT,
  ipHash: 'hash',
};

function makeDeps(overrides: Partial<SubmitDeps> = {}): SubmitDeps {
  return {
    saveMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    enqueue: vi.fn().mockResolvedValue(true),
    deliver: vi.fn().mockResolvedValue(true),
    now: () => NOW_MS,
    log: { warn: vi.fn(), error: vi.fn() },
    ...overrides,
  };
}

describe('submitContact', () => {
  it('stores the message, delivers it and reports sent without queueing', async () => {
    const deps = makeDeps();
    expect(await submitContact(input, deps)).toBe('sent');
    expect(deps.saveMessage).toHaveBeenCalledWith('req-1', savedPayload);
    expect(deps.deliver).toHaveBeenCalledWith('req-1', savedPayload, 'req-1');
    expect(deps.enqueue).not.toHaveBeenCalled();
    expect(deps.deleteMessage).not.toHaveBeenCalled();
  });

  it('reports storage_failed and delivers nothing when the write throws', async () => {
    const deps = makeDeps({ saveMessage: vi.fn().mockRejectedValue(new Error('kv down')) });
    expect(await submitContact(input, deps)).toBe('storage_failed');
    expect(deps.log.error).toHaveBeenCalledWith('KV write failed', {
      requestId: 'req-1',
      msgId: 'req-1',
    });
    expect(deps.deliver).not.toHaveBeenCalled();
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it('queues the message for retry when delivery fails', async () => {
    const deps = makeDeps({ deliver: vi.fn().mockResolvedValue(false) });
    expect(await submitContact(input, deps)).toBe('queued');
    expect(deps.enqueue).toHaveBeenCalledWith('req-1', RECEIVED_AT);
    expect(deps.deleteMessage).not.toHaveBeenCalled();
  });

  it('removes the stored message and logs when the outbox is full', async () => {
    const deps = makeDeps({
      deliver: vi.fn().mockResolvedValue(false),
      enqueue: vi.fn().mockResolvedValue(false),
    });
    expect(await submitContact(input, deps)).toBe('outbox_failed');
    expect(deps.log.warn).toHaveBeenCalledWith('contact outbox full', {
      requestId: 'req-1',
      msgId: 'req-1',
    });
    expect(deps.deleteMessage).toHaveBeenCalledWith('req-1');
  });

  it('removes the stored message and logs when the outbox write throws', async () => {
    const deps = makeDeps({
      deliver: vi.fn().mockResolvedValue(false),
      enqueue: vi.fn().mockRejectedValue(new Error('redis down')),
    });
    expect(await submitContact(input, deps)).toBe('outbox_failed');
    expect(deps.log.error).toHaveBeenCalledWith('contact outbox write failed', {
      requestId: 'req-1',
      msgId: 'req-1',
    });
    expect(deps.deleteMessage).toHaveBeenCalledWith('req-1');
  });

  it('still reports outbox_failed when the cleanup delete throws', async () => {
    const deps = makeDeps({
      deliver: vi.fn().mockResolvedValue(false),
      enqueue: vi.fn().mockResolvedValue(false),
      deleteMessage: vi.fn().mockRejectedValue(new Error('del failed')),
    });
    expect(await submitContact(input, deps)).toBe('outbox_failed');
    expect(deps.log.error).toHaveBeenCalledWith('contact message cleanup failed', {
      requestId: 'req-1',
      msgId: 'req-1',
    });
  });
});
