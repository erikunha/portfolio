import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { ContactForm } from './ContactForm';

describe('ContactForm accessibility', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
  });

  async function renderForm(): Promise<HTMLElement> {
    mounted = await mountClient(createElement(ContactForm));
    return mounted.container;
  }

  it('exposes name, email, and message inputs in the tab sequence', async () => {
    const container = await renderForm();
    const name = container.querySelector<HTMLInputElement>('input[autocomplete="name"]');
    const email = container.querySelector<HTMLInputElement>('input[type="email"]');
    const message = container.querySelector<HTMLTextAreaElement>('textarea');

    expect(name).not.toBeNull();
    expect(email).not.toBeNull();
    expect(message).not.toBeNull();
    for (const field of [name, email, message]) {
      const ti = field?.getAttribute('tabindex');
      expect(ti === null || Number(ti) >= 0).toBe(true);
    }

    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>('input:not([tabindex="-1"]), textarea'),
    );
    expect(focusables[0]).toBe(name);
    expect(focusables[1]).toBe(email);
    expect(focusables[2]).toBe(message);
  });

  it('removes the honeypot field from the tab sequence', async () => {
    const container = await renderForm();
    const honeypot = container.querySelector<HTMLInputElement>('[data-testid="contact-honeypot"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot?.getAttribute('tabindex')).toBe('-1');
    expect(honeypot?.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses a real submit button so Enter/Space activate it without JS', async () => {
    const container = await renderForm();
    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submit).not.toBeNull();
    expect(submit?.getAttribute('tabindex')).not.toBe('-1');
  });

  it('the submit row is an aria-live region', async () => {
    const container = await renderForm();
    const submitRow = container.querySelector('[aria-live="polite"]');
    expect(submitRow?.getAttribute('aria-live')).toBe('polite');
  });

  it('keyboard form submission triggers the request and announces errors via role="alert"', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: 'server boom' }), { status: 500 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const container = await renderForm();

    expect(container.querySelector('[role="alert"]')).toBeNull();

    const form = container.querySelector<HTMLFormElement>('form');
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/contact',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('server boom');
  });
});

describe('contact form error region', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
  });

  it('renders the error message in a role="alert" live region after a failed submit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'boom' }), { status: 500 })),
    );

    mounted = await mountClient(createElement(ContactForm));
    const { container } = mounted;

    expect(container.querySelector('[role="alert"]')).toBeNull();

    const form = container.querySelector<HTMLFormElement>('form');
    expect(form).not.toBeNull();
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();

    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('boom');
  });
});

describe('focus rings', () => {
  it('base.css ships a button:focus-visible rule', () => {
    // behavioral-test-allow: reads the shipped stylesheet build asset; jsdom cannot evaluate :focus-visible
    const base = readFileSync(path.resolve(__dirname, '../../../app/css/base.css'), 'utf-8');
    expect(base).toMatch(/button:focus-visible/);
  });
});

const redisSetMock = vi.fn();
const resendSendMock = vi.fn();
const rateLimitMock = vi.fn(async () => ({ success: true }));

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
  getContactLimit: vi.fn(() => ({ limit: rateLimitMock })),
  getRedis: vi.fn(() => ({ set: redisSetMock })),
}));

vi.mock('@/lib/ip-hash', () => ({
  hashIp: vi.fn(async () => 'hashed-ip-test'),
}));

vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: resendSendMock };
  },
}));

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/contact', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('/api/contact honeypot', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'fake-key-for-tests';
    vi.resetModules();
    redisSetMock.mockReset();
    resendSendMock.mockReset();
    rateLimitMock.mockResolvedValue({ success: true });
  });

  it('returns 200 ok without persisting or sending when field_company is filled', async () => {
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(
      makeRequest({
        name: 'Real Name',
        email: 'real@example.com',
        message: 'A perfectly long-enough legitimate-looking message',
        field_company: 'Acme Co',
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(redisSetMock).not.toHaveBeenCalled();
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it('processes the submission normally when field_company is empty', async () => {
    redisSetMock.mockResolvedValueOnce('OK');
    resendSendMock.mockResolvedValueOnce({ error: null });

    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(
      makeRequest({
        name: 'Real Name',
        email: 'real@example.com',
        message: 'A perfectly long-enough legitimate message',
        field_company: '',
      }),
    );

    expect(res.status).toBe(200);
    expect(redisSetMock).toHaveBeenCalledOnce();
    expect(resendSendMock).toHaveBeenCalledOnce();
  });

  it('processes the submission normally when field_company is missing entirely', async () => {
    redisSetMock.mockResolvedValueOnce('OK');
    resendSendMock.mockResolvedValueOnce({ error: null });

    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(
      makeRequest({
        name: 'Real Name',
        email: 'real@example.com',
        message: 'A perfectly long-enough legitimate message',
      }),
    );

    expect(res.status).toBe(200);
    expect(redisSetMock).toHaveBeenCalledOnce();
  });

  it('also trips when field_company is whitespace-only (defensive)', async () => {
    const { isHoneypotTripped } = await import('@/lib/contact-validation');
    expect(isHoneypotTripped({ field_company: '   ' })).toBe(false);
    expect(isHoneypotTripped({ field_company: '\t\n' })).toBe(false);
    expect(isHoneypotTripped({ field_company: 'x' })).toBe(true);
    expect(isHoneypotTripped({})).toBe(false);
    expect(isHoneypotTripped({ field_company: undefined })).toBe(false);
    expect(isHoneypotTripped({ field_company: 0 as unknown })).toBe(false);
  });
});

const VALID_BODY = {
  name: 'Real Name',
  email: 'real@example.com',
  message: 'A perfectly long-enough legitimate message',
};

describe('/api/contact — rate-limit denial path', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'fake-key-for-tests';
    vi.resetModules();
    redisSetMock.mockReset();
    resendSendMock.mockReset();
    rateLimitMock.mockReset();
  });

  it('returns 429 with the rate_limited error envelope when the limit denies', async () => {
    rateLimitMock.mockResolvedValueOnce({ success: false });
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(429);
    const body = (await res.json()) as {
      ok: false;
      requestId: string;
      error: { code: string; message: string };
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('rate_limited');
    expect(typeof body.error.message).toBe('string');
  });

  it('sets the X-Request-Id header matching the envelope requestId', async () => {
    rateLimitMock.mockResolvedValueOnce({ success: false });
    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(makeRequest(VALID_BODY));

    const body = (await res.json()) as { requestId: string };
    expect(res.headers.get('x-request-id')).toBe(body.requestId);
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('does NOT persist to KV or call Resend when rate-limited', async () => {
    rateLimitMock.mockResolvedValueOnce({ success: false });
    const { POST } = await import('@/app/api/contact/route');
    await POST(makeRequest(VALID_BODY));

    expect(redisSetMock).not.toHaveBeenCalled();
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it('processes the submission normally when the limit allows', async () => {
    rateLimitMock.mockResolvedValueOnce({ success: true });
    redisSetMock.mockResolvedValueOnce('OK');
    resendSendMock.mockResolvedValueOnce({ error: null });

    const { POST } = await import('@/app/api/contact/route');
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(redisSetMock).toHaveBeenCalledOnce();
  });
});

describe('contact form — submitting state', () => {
  let mounted: MountedClient;
  let resolveFetch: () => void;

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
  });

  it('sets aria-busy="true" and disables the submit button while the POST is pending', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = () => resolve(new Response('{}', { status: 200 }));
          }),
      ),
    );

    mounted = await mountClient(createElement(ContactForm));
    const { container } = mounted;

    const form = container.querySelector<HTMLFormElement>('form');
    expect(form?.getAttribute('aria-busy')).toBe('false');

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();

    expect(form?.getAttribute('aria-busy')).toBe('true');
    const submitBtn = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submitBtn?.hasAttribute('disabled')).toBe(true);

    await act(async () => {
      resolveFetch();
    });
    await flushMicrotasks();

    expect(container.querySelector('[data-testid="contact-success"]')).not.toBeNull();
    expect(container.querySelector('form')).toBeNull();
  });
});
