// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  env: { RESEND_API_KEY: 're_test_key' as string | undefined },
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/mail', () => ({ sendMail: mocks.sendMail }));
vi.mock('@/lib/env', () => ({ env: mocks.env }));
vi.mock('@/lib/log', async () =>
  (await import('@/__tests__/helpers/modules')).logModule(mocks.log),
);

const SENDER_NAME = 'Ada Lovelace';
const SENDER_EMAIL = 'ada.private@example.org';
const BODY_TEXT = 'confidential body text';
const REQUEST_ID = 'req-1';
const MSG_ID = 'msg-1';
const HTTP_UNPROCESSABLE = 422;
const PII = [SENDER_NAME, SENDER_EMAIL, BODY_TEXT];

const MESSAGE = {
  name: SENDER_NAME,
  email: SENDER_EMAIL,
  message: BODY_TEXT,
  receivedAt: '2026-01-01T00:00:00.000Z',
};

const leaky = `invalid reply_to ${SENDER_EMAIL} from ${SENDER_NAME}: ${BODY_TEXT}`;

function loggedLines(): string[] {
  return Object.values(mocks.log).flatMap((fn) =>
    fn.mock.calls.map((args) => JSON.stringify(args)),
  );
}

function expectNoPii(): void {
  const lines = loggedLines();
  expect(lines.length).toBeGreaterThan(0);
  for (const line of lines) {
    for (const secret of PII) expect(line).not.toContain(secret);
  }
}

describe('sendContactMessage log lines', () => {
  beforeEach(() => {
    vi.resetModules();
    for (const fn of Object.values(mocks.log)) fn.mockReset();
    mocks.sendMail.mockReset();
    mocks.env.RESEND_API_KEY = 're_test_key';
  });

  async function send(): Promise<boolean> {
    const { sendContactMessage } = await import('./delivery');
    return sendContactMessage(MSG_ID, MESSAGE, REQUEST_ID);
  }

  it('logs a distinct line when the API key is missing', async () => {
    mocks.env.RESEND_API_KEY = undefined;

    expect(await send()).toBe(false);

    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.log.error).toHaveBeenCalledOnce();
    expect(mocks.log.error).toHaveBeenCalledWith('contact delivery not configured', {
      requestId: REQUEST_ID,
      msgId: MSG_ID,
    });
  });

  it('keeps the unavailable line for a thrown error and names its class', async () => {
    class ProviderTimeoutError extends Error {
      override name = 'TimeoutError';
    }
    mocks.sendMail.mockRejectedValue(new ProviderTimeoutError(leaky));

    expect(await send()).toBe(false);

    expect(mocks.log.error).toHaveBeenCalledOnce();
    expect(mocks.log.error).toHaveBeenCalledWith('contact delivery unavailable', {
      requestId: REQUEST_ID,
      msgId: MSG_ID,
      errorName: 'TimeoutError',
    });
    expectNoPii();
  });

  it('logs no detail for a thrown value that is not an Error', async () => {
    mocks.sendMail.mockRejectedValue(leaky);

    expect(await send()).toBe(false);

    expect(mocks.log.error).toHaveBeenCalledWith('contact delivery unavailable', {
      requestId: REQUEST_ID,
      msgId: MSG_ID,
    });
    expectNoPii();
  });

  it('logs the provider error name and status code for a rejection, never its text', async () => {
    mocks.sendMail.mockResolvedValue({
      error: {
        name: 'validation_error',
        statusCode: HTTP_UNPROCESSABLE,
        message: leaky,
        to: SENDER_EMAIL,
        replyTo: SENDER_EMAIL,
        text: BODY_TEXT,
      },
    });

    expect(await send()).toBe(false);

    expect(mocks.log.error).toHaveBeenCalledOnce();
    expect(mocks.log.error).toHaveBeenCalledWith('contact delivery rejected', {
      requestId: REQUEST_ID,
      msgId: MSG_ID,
      errorName: 'validation_error',
      statusCode: HTTP_UNPROCESSABLE,
    });
    expectNoPii();
  });

  it('still resolves false and logs when the thrown value is null', async () => {
    mocks.sendMail.mockRejectedValue(null);

    expect(await send()).toBe(false);

    expect(mocks.log.error).toHaveBeenCalledWith('contact delivery unavailable', {
      requestId: REQUEST_ID,
      msgId: MSG_ID,
    });
  });

  it('logs no detail for a rejection that is not an object with a name', async () => {
    mocks.sendMail.mockResolvedValue({ error: leaky });

    expect(await send()).toBe(false);

    expect(mocks.log.error).toHaveBeenCalledWith('contact delivery rejected', {
      requestId: REQUEST_ID,
      msgId: MSG_ID,
    });
    expectNoPii();
  });

  it('logs nothing and returns true on success', async () => {
    mocks.sendMail.mockResolvedValue({ error: null });

    expect(await send()).toBe(true);

    expect(loggedLines()).toEqual([]);
  });
});
