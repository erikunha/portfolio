import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();
const resendCtor = vi.fn();

vi.mock('resend', () => ({
  // biome-ignore lint/complexity/useArrowFunction: `function` required, arrow fns cannot be used with `new` in jsdom/vitest.
  Resend: vi.fn(function (key: string) {
    resendCtor(key);
    return { emails: { send: sendMock } };
  }),
}));
vi.mock('@/lib/env', () => ({ env: { RESEND_API_KEY: 're_test_key' } }));

const TIMEOUT_MS = 7_000;
const MAIL = {
  from: 'a@example.com',
  to: 'b@example.com',
  replyTo: 'c@example.com',
  subject: 'subject',
  text: 'body',
  idempotencyKey: 'key-1',
  timeoutMs: TIMEOUT_MS,
};

describe('sendMail', () => {
  beforeEach(() => {
    vi.resetModules();
    sendMock.mockReset().mockResolvedValue({ data: { id: 'x' }, error: null });
    resendCtor.mockReset();
  });

  it('sends every field with the idempotency key and the configured api key', async () => {
    const { sendMail } = await import('@/lib/mail');
    await sendMail(MAIL);
    expect(resendCtor).toHaveBeenCalledWith('re_test_key');
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [payload, options] = sendMock.mock.calls[0] ?? [];
    expect(payload).toEqual({
      from: MAIL.from,
      to: MAIL.to,
      replyTo: MAIL.replyTo,
      subject: MAIL.subject,
      text: MAIL.text,
    });
    expect(options?.idempotencyKey).toBe('key-1');
  });

  it('omits the idempotency key when none is given', async () => {
    const { sendMail } = await import('@/lib/mail');
    const { idempotencyKey: _omit, ...rest } = MAIL;
    await sendMail(rest);
    expect(sendMock.mock.calls[0]?.[1]).not.toHaveProperty('idempotencyKey');
  });

  it('omits the reply-to address when none is given', async () => {
    const { sendMail } = await import('@/lib/mail');
    const { replyTo: _omit, ...rest } = MAIL;
    await sendMail(rest);
    expect(sendMock.mock.calls[0]?.[0]).not.toHaveProperty('replyTo');
  });

  it('returns the provider error', async () => {
    const providerError = { name: 'validation_error', message: 'bad' };
    sendMock.mockResolvedValue({ data: null, error: providerError });
    const { sendMail } = await import('@/lib/mail');
    await expect(sendMail(MAIL)).resolves.toEqual({ error: providerError });
  });

  it('returns a null error on success', async () => {
    const { sendMail } = await import('@/lib/mail');
    await expect(sendMail(MAIL)).resolves.toEqual({ error: null });
  });

  it('aborts the request through a signal that fires after the timeout', async () => {
    const controller = new AbortController();
    const reason = new DOMException('timed out', 'TimeoutError');
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    sendMock.mockImplementation(
      (_p: unknown, o: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          o.signal.addEventListener('abort', () => reject(o.signal.reason));
        }),
    );
    const { sendMail } = await import('@/lib/mail');
    const settled = expect(sendMail(MAIL)).rejects.toBe(reason);
    expect(timeoutSpy).toHaveBeenCalledWith(TIMEOUT_MS);
    controller.abort(reason);
    await settled;
    timeoutSpy.mockRestore();
  });
});
