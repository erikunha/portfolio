// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stalledUntilAborted } from '../tests/mocks/stalled-resend-send';

const sendMock = vi.fn();

vi.mock('resend', () => ({
  // biome-ignore lint/complexity/useArrowFunction: `function` required, arrow fns cannot be used with `new`.
  Resend: vi.fn(function () {
    return { emails: { send: sendMock } };
  }),
}));

vi.mock('@/lib/env', () => ({ env: { RESEND_API_KEY: 're_test_key' } }));

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const CONTACT_TIMEOUT_MS = 10_000;

const MESSAGE = {
  name: 'Ada',
  email: 'ada@example.com',
  message: 'hello',
  receivedAt: '2026-01-01T00:00:00.000Z',
  ipHash: 'hash',
};

describe('sendContactMessage timeout', () => {
  let controller: AbortController;

  beforeEach(() => {
    vi.resetModules();
    sendMock.mockReset();
    controller = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cancels the in-flight request through an abort signal and reports failure', async () => {
    sendMock.mockImplementation(stalledUntilAborted);
    const { sendContactMessage } = await import('@/lib/contact-delivery');

    const pending = sendContactMessage('msg-1', MESSAGE, 'req-1');
    controller.abort(new DOMException('timed out', 'TimeoutError'));

    await expect(pending).resolves.toBe(false);
    expect(AbortSignal.timeout).toHaveBeenCalledWith(CONTACT_TIMEOUT_MS);
    expect(sendMock.mock.calls[0]?.[1]).toMatchObject({
      idempotencyKey: 'contact:msg-1',
      signal: controller.signal,
    });
  });
});
