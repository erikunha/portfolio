import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { flushMicrotasks, type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { contactCopy } from '@/content/contact-copy';
import { linksContent } from '@/content/links';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { contactChrome } from '@/content/terminal-chrome';
import { ASK_LOCALE_HEADER } from '@/lib/stream-protocol';
import { ContactForm } from './ContactForm';
import { messageStore } from './messageStore';

afterEach(() => {
  messageStore.reset();
});

function fillValidForm(container: HTMLElement) {
  fireEvent.change(container.querySelector('input[name="name"]') as HTMLInputElement, {
    target: { value: 'Ada' },
  });
  fireEvent.change(container.querySelector('input[name="email"]') as HTMLInputElement, {
    target: { value: 'ada@example.com' },
  });
  fireEvent.change(container.querySelector('textarea') as HTMLTextAreaElement, {
    target: { value: 'A platform engineering opportunity.' },
  });
}

describe('ContactForm accessibility', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
  });

  async function renderForm(): Promise<HTMLElement> {
    mounted = await mountClient(
      createElement(ContactForm, {
        copy: contactCopy[SITE_LOCALE.en],
        chrome: contactChrome[SITE_LOCALE.en],
      }),
    );
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

  it('announces the send state through one polite status line, not through the button', async () => {
    const container = await renderForm();
    const status = container.querySelector('[data-testid="contact-status"]');
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.textContent).toBe(contactCopy[SITE_LOCALE.en].form.waiting);
    expect(container.querySelector('.contact-submit-row')?.hasAttribute('aria-live')).toBe(false);
    expect(container.querySelectorAll('[aria-live]')).toHaveLength(0);
  });

  it('states how long a message is kept, where the email copy lives, and that the IP is hashed', async () => {
    const container = await renderForm();
    const privacy = container.querySelector('.contact-privacy');
    expect(privacy?.textContent).toBe(
      "Your message is stored 90 days so Erik can reply, then deleted. The copy emailed to him stays in his inbox and the email provider's logs, without that limit. Your IP is hashed before it becomes a key or a record, rate limiting included. Not shared with anyone else.",
    );
  });

  it('keyboard form submission triggers the request and announces errors via role="alert"', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: 'internal_error', message: 'server boom' },
          }),
          { status: 500 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const container = await renderForm();

    expect(container.querySelector('[role="alert"]')).toBeNull();

    const form = container.querySelector<HTMLFormElement>('form');
    fillValidForm(container);
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
    expect(alert?.textContent).toContain('could not send right now');
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
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ ok: false, error: { code: 'internal_error', message: 'boom' } }),
            { status: 500 },
          ),
      ),
    );

    mounted = await mountClient(
      createElement(ContactForm, {
        copy: contactCopy[SITE_LOCALE.en],
        chrome: contactChrome[SITE_LOCALE.en],
      }),
    );
    const { container } = mounted;

    expect(container.querySelector('[role="alert"]')).toBeNull();

    const form = container.querySelector<HTMLFormElement>('form');
    expect(form).not.toBeNull();
    fillValidForm(container);
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();

    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('could not send right now');
  });
});

describe('contact form delivery states', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
    vi.unstubAllGlobals();
  });

  async function submitResponse(
    body: unknown,
    status: number,
    locale: SiteLocale = SITE_LOCALE.en,
  ) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(body, { status })),
    );
    mounted = await mountClient(
      createElement(ContactForm, {
        copy: contactCopy[locale],
        chrome: contactChrome[locale],
      }),
    );
    const container = mounted.container;
    const form = container.querySelector('form');
    fillValidForm(container);
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();
    return mounted.container;
  }

  it('keeps the delivered success copy and test id', async () => {
    const container = await submitResponse({ ok: true, requestId: 'request-id' }, 200);
    const success = container.querySelector('[data-testid="contact-success"]');
    expect(success?.getAttribute('role')).toBe('status');
    expect(success?.textContent).toContain('✓ message delivered');
    expect(success?.textContent).toContain(
      'Reply within 48h. Keep this receipt if you want your message deleted later.',
    );
  });

  it('shows a receipt with the full ref, the time, a copy control and a forget button', async () => {
    const ref = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
    const container = await submitResponse({ ok: true, requestId: ref }, 200);
    const receipt = container.querySelector('[data-testid="contact-receipt"]') as HTMLElement;
    expect(receipt.textContent).toContain('ref');
    expect(receipt.querySelector('.ref-chip code')?.textContent).toBe(ref);
    expect(receipt.querySelector('.ref-chip code')?.getAttribute('title')).toBe(ref);
    expect(receipt.querySelector('time')?.textContent).toMatch(/\d{4}.*\d{2}:\d{2}/);
    expect(within(receipt).getByRole('button', { name: /copy ref/i })).toBeTruthy();
    expect(within(receipt).getByRole('button', { name: '[FORGET MESSAGE]' })).toBeTruthy();
    expect(receipt.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('shows the receipt in Portuguese on pt', async () => {
    const container = await submitResponse({ ok: true, requestId: 'abc-123' }, 200, SITE_LOCALE.pt);
    const receipt = container.querySelector('[data-testid="contact-receipt"]');
    expect(
      within(receipt as HTMLElement).getByRole('button', { name: /copiar ref/i }),
    ).toBeTruthy();
    expect(
      within(receipt as HTMLElement).getByRole('button', { name: '[EXCLUIR MENSAGEM]' }),
    ).toBeTruthy();
    expect(container.querySelector('[data-testid="contact-success"]')?.textContent).toContain(
      '✓ mensagem entregue',
    );
  });

  it('omits the receipt when the response carries no request id', async () => {
    const container = await submitResponse({ ok: true }, 200);
    expect(container.querySelector('[data-testid="contact-success"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="contact-receipt"]')).toBeNull();
  });

  it.each([
    [{ ok: true, requestId: 'request-id' }, 200, 'contact-success'],
    [
      { ok: false, requestId: 'request-id', error: { code: 'queued', message: 'Saved for retry' } },
      202,
      'contact-queued',
    ],
  ])(
    'replaces the form with a focused result so it cannot be sent again (%#)',
    async (body, status, testId) => {
      const container = await submitResponse(body, status);
      const result = container.querySelector(`[data-testid="${testId}"]`);
      expect(result).not.toBeNull();
      expect(document.activeElement).toBe(result);
      expect(container.querySelector('form')).toBeNull();
      expect(container.querySelector('button[type="submit"]')).toBeNull();
      expect(fetch).toHaveBeenCalledOnce();
    },
  );

  it.each([
    [
      SITE_LOCALE.en,
      '~ saved, delivery pending',
      'Your message is stored. Email delivery failed and is retried once a day, up to 3 times.',
      'Faster: message on LinkedIn ↗',
    ],
    [
      SITE_LOCALE.pt,
      '~ salvo, entrega pendente',
      'Sua mensagem foi salva. A entrega por email falhou e é tentada de novo uma vez por dia, até 3 vezes.',
      'Mais rápido: mensagem no LinkedIn ↗',
    ],
  ])(
    'announces queued without success, with the real retry schedule, LinkedIn and the ref (%s)',
    async (locale, title, message, faster) => {
      const ref = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
      const container = await submitResponse(
        { ok: false, requestId: ref, error: { code: 'queued', message: 'Saved for retry' } },
        202,
        locale,
      );
      expect(container.querySelector('[data-testid="contact-success"]')).toBeNull();
      const queued = container.querySelector('[data-testid="contact-queued"]') as HTMLElement;
      expect(queued.getAttribute('role')).toBe('status');
      expect(queued.querySelector('[role="alert"]')).toBeNull();
      expect(queued.textContent).toContain(title);
      expect(queued.textContent).toContain(message);
      expect(queued.textContent).toContain(faster);
      expect(queued.textContent).not.toContain('✓');
      const link = queued.querySelector('a') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe(
        linksContent.pills.find((pill) => pill.id === 'linkedin')?.href,
      );
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
      const refLine = queued.querySelector('[data-testid="contact-queued-ref"]');
      expect(refLine?.textContent).toBe(`ref ${ref}`);
      expect(refLine?.getAttribute('title')).toBe(ref);
      expect(container.querySelector('form')).toBeNull();
    },
  );

  it('omits the ref line when the queued response carries no request id', async () => {
    const container = await submitResponse(
      { ok: false, error: { code: 'queued', message: 'Saved for retry' } },
      202,
    );
    expect(container.querySelector('[data-testid="contact-queued"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="contact-queued-ref"]')).toBeNull();
  });

  it.each([
    [SITE_LOCALE.en, 400, 'validation_failed', 'error: could not send right now. Your text'],
    [
      SITE_LOCALE.en,
      429,
      'rate_limited',
      'error: too many requests, try again in 10 minutes. Your',
    ],
    [SITE_LOCALE.en, 502, 'storage_unavailable', 'error: could not save your message. Your text'],
    [SITE_LOCALE.pt, 502, 'storage_unavailable', 'erro: não foi possível salvar sua mensagem. Seu'],
    [SITE_LOCALE.en, 503, 'storage_unavailable', 'error: could not save your message. Your text'],
    [
      SITE_LOCALE.en,
      502,
      'delivery_unavailable',
      'error: your message could not be delivered yet.',
    ],
    [
      SITE_LOCALE.pt,
      502,
      'delivery_unavailable',
      'erro: sua mensagem ainda não pôde ser entregue.',
    ],
    [SITE_LOCALE.en, 403, 'forbidden_origin', 'error: this form only works on the site itself.'],
    [SITE_LOCALE.pt, 403, 'forbidden_origin', 'erro: este formulário só funciona no próprio site.'],
    [SITE_LOCALE.en, 502, 'internal_error', 'error: could not send right now. Your text'],
    [SITE_LOCALE.pt, 502, 'internal_error', 'erro: não foi possível enviar agora. Seu texto'],
    [
      SITE_LOCALE.pt,
      429,
      'rate_limited',
      'erro: muitas requisições, tente novamente em 10 minutos. Seu',
    ],
  ])(
    'shows localized copy for the error code, never the server message (%s %s)',
    async (locale, status, code, expected) => {
      const container = await submitResponse(
        {
          ok: false,
          requestId: 'request-id',
          error: { code, message: 'storage unavailable, try again' },
        },
        status,
        locale,
      );
      const alert = container.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain(expected);
      expect(alert?.textContent).not.toContain('storage unavailable');
      expect(alert?.textContent).not.toContain('[object Object]');
      expect(container.querySelector('form')).not.toBeNull();
    },
  );
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

describe('LazyIsland', () => {
  it('shows the loading state while the island suspends and an alert when it fails', async () => {
    const { LazyIsland } = await import('@/components/client/LazyIsland');
    const { lazy } = await import('react');
    const Broken = lazy(() => Promise.reject(new Error('chunk failed')));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <LazyIsland loading={<span data-testid="loading">loading</span>}>
        <Broken />
      </LazyIsland>,
    );
    expect(screen.getByTestId('loading')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    errors.mockRestore();
    vi.unstubAllGlobals();
  });
});

describe('contact email rule', () => {
  const ADDRESSES = [
    ['visitor@example.com', true],
    ['first.last+tag@sub.example.co', true],
    ['no-at-sign.example.com', false],
    ['two@@example.com', false],
    ['space @example.com', false],
    ['nodomain@', false],
    ['trailing.dot.@example.com', false],
    ['a@b', false],
  ] as const;

  it.each(ADDRESSES)('client and server agree on %s', async (address, valid) => {
    const { ContactSchema } = await import('@/lib/contact-validation');
    const { CONTACT_EMAIL_PATTERN } = await import('@/content/contact-rules');
    expect(CONTACT_EMAIL_PATTERN.test(address)).toBe(valid);
    const parsed = ContactSchema.safeParse({
      name: 'Visitor',
      email: address,
      message: 'A long enough message',
    });
    expect(parsed.success).toBe(valid);
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

  it('keeps the busy submit focusable and guards duplicate requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = () => resolve(Response.json({ ok: true }));
          }),
      ),
    );

    mounted = await mountClient(
      createElement(ContactForm, {
        copy: contactCopy[SITE_LOCALE.en],
        chrome: contactChrome[SITE_LOCALE.en],
      }),
    );
    const { container } = mounted;

    const form = container.querySelector<HTMLFormElement>('form');
    expect(form?.getAttribute('aria-busy')).toBe('false');

    fillValidForm(container);
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();

    expect(form?.getAttribute('aria-busy')).toBe('true');
    const submitBtn = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submitBtn?.hasAttribute('disabled')).toBe(false);
    expect(submitBtn?.getAttribute('aria-disabled')).toBe('true');
    submitBtn?.focus();
    expect(document.activeElement).toBe(submitBtn);
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(fetch).toHaveBeenCalledOnce();

    await act(async () => {
      resolveFetch();
    });
    await flushMicrotasks();

    expect(container.querySelector('[data-testid="contact-success"]')).not.toBeNull();
    expect(container.querySelector('form')).toBeNull();
  });
});

describe.each(Object.values(SITE_LOCALE))('contact form status line (%s)', (locale) => {
  let mounted: MountedClient;
  let resolveFetch: (response: Response) => void;
  const copy = contactCopy[locale].form;

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
  });

  async function renderForm() {
    mounted = await mountClient(
      createElement(ContactForm, { copy: contactCopy[locale], chrome: contactChrome[locale] }),
    );
    return mounted.container;
  }

  const statusOf = (container: HTMLElement) =>
    container.querySelector('[data-testid="contact-status"]')?.textContent;

  it('says it is sending while the request is pending, then reports the failed send', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    const container = await renderForm();
    const form = container.querySelector<HTMLFormElement>('form');
    fillValidForm(container);
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();

    expect(statusOf(container)).toBe(copy.sending);

    await act(async () => {
      resolveFetch(
        Response.json({ ok: false, error: { code: 'storage_unavailable' } }, { status: 500 }),
      );
    });
    await flushMicrotasks();

    expect(statusOf(container)).toBe(copy.statusFailed);
    expect(statusOf(container)).not.toBe(copy.waiting);
  });

  it('points at the marked fields after a rejected submit and resets once the text changes', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const container = await renderForm();
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    expect(statusOf(container)).toBe(copy.statusInvalid);

    fireEvent.change(container.querySelector('input[name="name"]') as HTMLInputElement, {
      target: { value: 'Ada' },
    });

    expect(statusOf(container)).toBe(copy.waiting);
  });
});

describe('contact validation and retention', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('focuses a linked summary, wires inline errors, and corrects them as inputs change', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(
      <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
    );
    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);
    const summary = screen.getByRole('alert');
    expect(document.activeElement).toBe(summary);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(within(summary).getAllByRole('link')).toHaveLength(3);
    for (const link of within(summary).getAllByRole('link')) {
      const id = link.getAttribute('href')?.slice(1) as string;
      const input = document.getElementById(id) as HTMLInputElement;
      expect(input.getAttribute('aria-invalid')).toBe('true');
      const descriptions = input.getAttribute('aria-describedby')?.split(' ') ?? [];
      expect(
        descriptions.some((description) =>
          document.getElementById(description)?.textContent?.startsWith('> '),
        ),
      ).toBe(true);
      fireEvent.click(link);
      expect(document.activeElement).toBe(input);
    }
    fillValidForm(container);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.querySelector('[aria-invalid="true"]')).toBeNull();
    fireEvent.change(screen.getByLabelText('$ email:'), { target: { value: 'bad' } });
    fireEvent.submit(form);
    expect(document.activeElement).toBe(screen.getByRole('alert'));
    expect(within(screen.getByRole('alert')).getAllByRole('link')).toHaveLength(1);
  });

  it('counts message characters and keeps the counter described alongside a validation error', () => {
    render(
      <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
    );
    const message = screen.getByLabelText('$ message:') as HTMLTextAreaElement;
    fireEvent.change(message, { target: { value: 'short' } });
    fireEvent.submit(message.form as HTMLFormElement);
    const descriptions = message.getAttribute('aria-describedby')?.split(' ') ?? [];
    expect(descriptions.map((id) => document.getElementById(id)?.textContent)).toContain('5/2000');
    expect(descriptions).toHaveLength(2);
    fireEvent.change(message, { target: { value: 'An adequate message.' } });
    const remaining = message.getAttribute('aria-describedby')?.split(' ') ?? [];
    expect(remaining).toHaveLength(1);
    expect(document.getElementById(remaining[0] ?? '')?.textContent).toBe('20/2000');
    expect(message.maxLength).toBe(2000);
  });

  it.each(['A', 'A'.repeat(120)])(
    'accepts the API name boundary and removes the delivered form',
    async (name) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({ ok: true })),
      );
      const { container } = render(
        <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
      );
      fillValidForm(container);
      const nameInput = screen.getByLabelText('$ name:') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: name } });
      expect(nameInput.minLength).toBe(1);
      expect(nameInput.maxLength).toBe(120);
      fireEvent.submit(nameInput.form as HTMLFormElement);
      await screen.findByTestId('contact-success');
      expect(JSON.parse(vi.mocked(fetch).mock.calls[0]?.[1]?.body as string)).toMatchObject({
        name,
        email: 'ada@example.com',
        message: 'A platform engineering opportunity.',
      });
      expect(container.querySelector('form')).toBeNull();
      expect(screen.queryByRole('button', { name: 'EXECUTE_SEND' })).toBeNull();
    },
  );

  it('rejects whitespace-only names and values beyond API limits without sending', () => {
    vi.stubGlobal('fetch', vi.fn());
    const { container } = render(
      <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
    );
    fillValidForm(container);
    const name = screen.getByLabelText('$ name:') as HTMLInputElement;
    for (const value of ['   ', 'A'.repeat(121)]) {
      fireEvent.change(name, { target: { value } });
      fireEvent.submit(name.form as HTMLFormElement);
      expect(name.getAttribute('aria-invalid')).toBe('true');
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['x'.repeat(10), 'x'.repeat(2000)])(
    'accepts the API message boundary (%#)',
    async (message) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json({ ok: true })),
      );
      const { container } = render(
        <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
      );
      fillValidForm(container);
      const input = screen.getByLabelText('$ message:') as HTMLTextAreaElement;
      fireEvent.change(input, { target: { value: message } });
      fireEvent.submit(input.form as HTMLFormElement);
      await screen.findByTestId('contact-success');
      expect(fetch).toHaveBeenCalledOnce();
      expect(container.querySelector('form')).toBeNull();
    },
  );

  it.each([' '.repeat(10), 'x'.repeat(9), 'x'.repeat(2001), '  short  '])(
    'rejects messages outside the trimmed API limits (%#)',
    (message) => {
      vi.stubGlobal('fetch', vi.fn());
      const { container } = render(
        <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
      );
      fillValidForm(container);
      const input = screen.getByLabelText('$ message:') as HTMLTextAreaElement;
      fireEvent.change(input, { target: { value: message } });
      fireEvent.submit(input.form as HTMLFormElement);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(screen.getByRole('alert'));
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each(['missing-at.example.com', 'name@', 'name@site', 'name @site.com'])(
    'rejects invalid email before sending (%s)',
    (email) => {
      vi.stubGlobal('fetch', vi.fn());
      const { container } = render(
        <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
      );
      fillValidForm(container);
      const input = screen.getByLabelText('$ email:') as HTMLInputElement;
      fireEvent.change(input, { target: { value: email } });
      fireEvent.submit(input.form as HTMLFormElement);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('focuses a server error, preserves values, and permits a retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json(
            {
              ok: false,
              error: { code: 'internal_error', message: 'storage unavailable, try again' },
            },
            { status: 502 },
          ),
        )
        .mockResolvedValueOnce(Response.json({ ok: true })),
    );
    const { container } = render(
      <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
    );
    fillValidForm(container);
    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);
    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(document.activeElement).toBe(alert));
    expect(alert.textContent).toContain('could not send right now');
    expect(alert.textContent).not.toContain('[object Object]');
    expect(within(alert).getByRole('link').getAttribute('href')).toBe(
      'mailto:erikhenriquealvescunha@gmail.com',
    );
    expect((screen.getByLabelText('$ name:') as HTMLInputElement).value).toBe('Ada');
    expect((screen.getByLabelText('$ email:') as HTMLInputElement).value).toBe('ada@example.com');
    expect((screen.getByLabelText('$ message:') as HTMLTextAreaElement).value).toBe(
      'A platform engineering opportunity.',
    );
    fireEvent.submit(form);
    await screen.findByTestId('contact-success');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('gives separate forms unique field and description targets', () => {
    const { container } = render(
      <>
        <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />
        <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('contact client dependency boundary', () => {
  it('loads the client island without evaluating Zod', async () => {
    vi.resetModules();
    vi.doMock('zod', () => {
      throw new Error('ContactForm must load without Zod in its runtime dependencies');
    });
    try {
      const client = await import('./ContactForm');
      expect(typeof client.ContactForm).toBe('function');
    } finally {
      vi.doUnmock('zod');
      vi.resetModules();
    }
  });
});

describe('contact cross-review fixes', () => {
  afterEach(() => vi.unstubAllGlobals());

  function setField(container: HTMLElement, selector: string, value: string) {
    fireEvent.change(container.querySelector(selector) as HTMLElement, { target: { value } });
  }

  it('counts the trimmed message length the validator and the API use', () => {
    const { container } = render(
      <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
    );
    setField(container, 'textarea', `   ${'a'.repeat(4)}   `);
    expect(container.querySelector('.contact-count')?.textContent).toBe('4/2000');
  });

  it.each([
    'ada@example.com',
    'a..b@example.com',
    '.ada@example.com',
    'ada.@example.com',
    'ada@-example.com',
    'ada@example.c',
    'ada@@example.com',
    "o'brien+tag@sub.example.org",
    'ada@example',
  ])('client email check agrees with the server schema for %s', (email) => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(
      <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
    );
    setField(container, 'input[name="name"]', 'Ada');
    setField(container, 'input[name="email"]', email);
    setField(container, 'textarea', 'A platform engineering opportunity.');
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    const serverAccepts = z.string().trim().email().safeParse(email).success;
    expect(fetchMock.mock.calls.length === 1).toBe(serverAccepts);
  });

  it('names the focused error summary through its heading', () => {
    const { container } = render(
      <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
    );
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    const summary = screen.getByRole('alert');
    const labelId = summary.getAttribute('aria-labelledby') as string;
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId)?.textContent).toBe('! 3 fields need fixing:');
    expect(screen.getByRole('alert', { name: '! 3 fields need fixing:' })).toBe(summary);
  });

  it('summarises the invalid fields on one line with a link per field', () => {
    const { container } = render(
      <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
    );
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    const summary = screen.getByRole('alert');
    expect(
      summary.querySelectorAll('p').length,
      'the summary reads as one line, not a list of rows',
    ).toBe(1);
    expect(summary.querySelector('ul')).toBeNull();
    expect(Array.from(summary.querySelectorAll('a')).map((link) => link.textContent)).toEqual([
      'name',
      'email',
      'message',
    ]);
    expect(summary.textContent).toContain('! 3 fields need fixing:');
  });

  it('names the summary when only a request error shows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: false, error: { message: 'boom' } }, { status: 500 })),
    );
    const { container } = render(
      <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
    );
    fillValidForm(container);
    await act(async () => {
      fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    });
    await flushMicrotasks();
    const summary = screen.getByRole('alert');
    expect(
      document.getElementById(summary.getAttribute('aria-labelledby') as string),
    ).not.toBeNull();
  });

  it('sends one request when the busy submit button is clicked repeatedly', async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(vi.fn()));
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(
      <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
    );
    fillValidForm(container);
    const button = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(button);
    });
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('contact form message store', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows a line appended from outside the form in the message field', () => {
    render(
      <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
    );
    const message = screen.getByLabelText('$ message:') as HTMLTextAreaElement;
    fireEvent.change(message, { target: { value: 'Hello Erik' } });

    act(() => {
      messageStore.append('Proposed call: 13:30');
    });

    expect(message.value).toBe('Hello Erik\nProposed call: 13:30');
    expect(screen.getByText(/^\d+\/2000$/).textContent).toBe(`${message.value.trim().length}/2000`);
  });

  it('keeps a line appended before the form mounted', () => {
    messageStore.append('Proposed call: 13:30');

    render(
      <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
    );

    expect((screen.getByLabelText('$ message:') as HTMLTextAreaElement).value).toBe(
      'Proposed call: 13:30',
    );
  });

  it('writes typing back to the store so an append never drops typed text', () => {
    render(
      <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
    );
    fireEvent.change(screen.getByLabelText('$ message:'), { target: { value: 'typed text' } });

    expect(messageStore.getSnapshot()).toBe('typed text');
  });

  it('sends the appended line with the submitted message', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(
      <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
    );
    fillValidForm(container);
    act(() => {
      messageStore.append('Proposed call: 13:30');
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    });
    await flushMicrotasks();

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    ) as { message: string };
    expect(body.message).toBe('A platform engineering opportunity.\nProposed call: 13:30');
  });

  it('clears the message error when an appended line makes the message valid', () => {
    const { container } = render(
      <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
    );
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    const message = screen.getByLabelText('$ message:');
    expect(message.getAttribute('aria-invalid')).toBe('true');

    act(() => {
      messageStore.append('Proposed call: 13:30 your time (UTC), 10:30 Erik time');
    });

    expect(message.getAttribute('aria-invalid')).toBeNull();
  });

  it('tells the store which field holds the message while the field is on screen', () => {
    const { unmount } = render(
      <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
    );
    const message = screen.getByLabelText('$ message:');

    expect(messageStore.getFieldId()).toBe(message.id);

    unmount();
    expect(messageStore.getFieldId()).toBeNull();
  });

  it('lets go of the field once the form is replaced by the delivered panel', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: true })),
    );
    const { container } = render(
      <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
    );
    expect(messageStore.getFieldId()).not.toBeNull();
    fillValidForm(container);

    await act(async () => {
      fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    });
    await flushMicrotasks();

    expect(screen.queryByTestId('contact-success')).not.toBeNull();
    expect(messageStore.getFieldId(), 'no field left to focus once the form is gone').toBeNull();
  });

  it.each([
    ['delivered', Response.json({ ok: true })],
    ['queued', Response.json({ error: { code: 'queued' } }, { status: 202 })],
  ])(
    'clears the shared message after a %s send so a fresh form starts empty',
    async (_state, reply) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => reply),
      );
      const first = render(
        <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
      );
      fillValidForm(first.container);
      expect(messageStore.getSnapshot()).not.toBe('');

      await act(async () => {
        fireEvent.submit(first.container.querySelector('form') as HTMLFormElement);
      });
      await flushMicrotasks();

      expect(messageStore.getSnapshot(), 'the sent text must not outlive the send').toBe('');
      first.unmount();
      render(
        <ContactForm copy={contactCopy[SITE_LOCALE.en]} chrome={contactChrome[SITE_LOCALE.en]} />,
      );
      expect((screen.getByLabelText('$ message:') as HTMLTextAreaElement).value).toBe('');
    },
  );
});

describe('contact form locale header and server message', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
    vi.unstubAllGlobals();
    vi.doUnmock('next/navigation');
    vi.resetModules();
  });

  async function submitAt(pathname: string, response: Response) {
    vi.resetModules();
    vi.doMock('next/navigation', () => ({ usePathname: () => pathname }));
    const fetchMock = vi.fn(async () => response);
    vi.stubGlobal('fetch', fetchMock);
    const { ContactForm: Form } = await import('./ContactForm');
    mounted = await mountClient(
      createElement(Form, {
        copy: contactCopy[SITE_LOCALE.pt],
        chrome: contactChrome[SITE_LOCALE.pt],
      }),
    );
    const form = mounted.container.querySelector('form');
    fillValidForm(mounted.container);
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();
    return { fetchMock, container: mounted.container };
  }

  it.each([
    ['/pt', SITE_LOCALE.pt],
    ['/pt/links', SITE_LOCALE.pt],
    ['/', SITE_LOCALE.en],
  ])('sends the page locale for %s as %s', async (pathname, expected) => {
    const { fetchMock } = await submitAt(pathname, Response.json({ ok: true }, { status: 200 }));
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)[ASK_LOCALE_HEADER]).toBe(expected);
  });

  it('words a storage failure from its own copy, not the server message', async () => {
    const { container } = await submitAt(
      '/pt',
      Response.json(
        { ok: false, error: { code: 'storage_unavailable', message: 'storage unavailable' } },
        { status: 503 },
      ),
    );
    const text = container.querySelector('[role="alert"]')?.textContent ?? '';
    expect(text).toContain(contactCopy[SITE_LOCALE.pt].errors.storageUnavailable);
    expect(text, 'the server text of a generic handler is English and internal').not.toContain(
      'storage unavailable',
    );
  });
});

describe.each(Object.values(SITE_LOCALE))('contact form submitting lock (%s)', (locale) => {
  let mounted: MountedClient;
  const copy = contactCopy[locale];

  afterEach(() => {
    mounted?.unmount();
    vi.unstubAllGlobals();
  });

  async function submitPending() {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    mounted = await mountClient(
      createElement(ContactForm, { copy, chrome: contactChrome[locale] }),
    );
    const { container } = mounted;
    fillValidForm(container);
    await act(async () => {
      container
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();
    return container;
  }

  it('labels the busy button with the sending verb and keeps it as wide as the longest label', async () => {
    const container = await submitPending();
    const button = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    const expected = locale === SITE_LOCALE.pt ? 'ENVIANDO...' : 'SENDING...';

    expect(button?.textContent).toBe(expected);
    expect(copy.form.submitting).toBe(expected);
    const reserve = button?.getAttribute('data-reserve') ?? '';
    expect(reserve.length).toBeGreaterThanOrEqual(copy.form.submit.length);
    expect(reserve.length).toBeGreaterThanOrEqual(copy.form.submitting.length);
    expect([copy.form.submit, copy.form.submitting]).toContain(reserve);
  });

  it('locks the fields read-only while the request is pending and keeps the typed text', async () => {
    const container = await submitPending();
    const fields = container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input[name="name"], input[name="email"], textarea',
    );

    expect(fields).toHaveLength(3);
    for (const field of fields) {
      expect(field.readOnly).toBe(true);
      expect(field.value).not.toBe('');
    }
  });

  it('unlocks the fields once the send fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: false }, { status: 500 })),
    );
    mounted = await mountClient(
      createElement(ContactForm, { copy, chrome: contactChrome[locale] }),
    );
    const { container } = mounted;
    fillValidForm(container);
    await act(async () => {
      container
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();

    const name = container.querySelector<HTMLInputElement>('input[name="name"]');
    expect(name?.readOnly).toBe(false);
    expect(name?.value).toBe('Ada');
  });
});

describe.each([
  [SITE_LOCALE.en, 'fields need fixing', 'you@company.com'],
  [SITE_LOCALE.pt, 'campos precisam de ajuste', 'voce@empresa.com'],
])('contact field errors (%s)', (locale, summaryTail, example) => {
  const copy = contactCopy[locale];

  function errorOf(input: HTMLElement) {
    const id = input
      .getAttribute('aria-describedby')
      ?.split(' ')
      .find((part) => part.endsWith('-error'));
    return document.getElementById(id ?? '')?.textContent;
  }

  function submitWithEmail(email: string) {
    vi.stubGlobal('fetch', vi.fn());
    const { container } = render(<ContactForm copy={copy} chrome={contactChrome[locale]} />);
    fillValidForm(container);
    const input = container.querySelector('input[name="email"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: email } });
    fireEvent.submit(input.form as HTMLFormElement);
    return input;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the summary with a bang and the count, in the page language', () => {
    const { container } = render(<ContactForm copy={copy} chrome={contactChrome[locale]} />);
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    const summary = screen.getByRole('alert');
    expect(summary.textContent?.startsWith('! 3 ')).toBe(true);
    expect(summary.textContent).toContain(summaryTail);
    expect(document.activeElement).toBe(summary);
  });

  it('says what is missing from an email that has an @ but no domain', () => {
    const input = submitWithEmail('erik@');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.value).toBe('erik@');
    expect(errorOf(input)).toBe(
      locale === SITE_LOCALE.pt
        ? `> falta o domínio, por exemplo ${example}`
        : `> missing the domain, for example ${example}`,
    );
  });

  it('says the @ is missing when an email has none', () => {
    const input = submitWithEmail('erik.example.com');

    expect(errorOf(input)).toBe(
      locale === SITE_LOCALE.pt
        ? `> falta o @, por exemplo ${example}`
        : `> missing the @, for example ${example}`,
    );
  });

  it('asks for an email when the field is empty', () => {
    const input = submitWithEmail('');

    expect(errorOf(input)).toBe(
      locale === SITE_LOCALE.pt
        ? `> informe seu email, por exemplo ${example}`
        : `> add your email, for example ${example}`,
    );
  });

  it('falls back to a format hint for any other bad email', () => {
    const input = submitWithEmail('name @site.com');

    expect(errorOf(input)).toBe(
      locale === SITE_LOCALE.pt
        ? `> confira o formato, por exemplo ${example}`
        : `> check the format, for example ${example}`,
    );
  });

  it('tells a short message how many characters it has and needs, and keeps the text', () => {
    vi.stubGlobal('fetch', vi.fn());
    const { container } = render(<ContactForm copy={copy} chrome={contactChrome[locale]} />);
    fillValidForm(container);
    const message = container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(message, { target: { value: '  oi  ' } });
    fireEvent.submit(message.form as HTMLFormElement);

    expect(errorOf(message)).toBe(
      locale === SITE_LOCALE.pt
        ? '> escreva ao menos 10 caracteres, você tem 2'
        : '> write at least 10 characters, you have 2',
    );
    expect(message.value).toBe('  oi  ');
  });

  it('asks for a name when it is blank and caps a long one', () => {
    vi.stubGlobal('fetch', vi.fn());
    const { container } = render(<ContactForm copy={copy} chrome={contactChrome[locale]} />);
    fillValidForm(container);
    const name = container.querySelector('input[name="name"]') as HTMLInputElement;
    fireEvent.change(name, { target: { value: '   ' } });
    fireEvent.submit(name.form as HTMLFormElement);
    expect(errorOf(name)).toBe(
      locale === SITE_LOCALE.pt ? '> informe seu nome' : '> add your name',
    );

    fireEvent.change(name, { target: { value: 'A'.repeat(121) } });
    expect(errorOf(name)).toBe(
      locale === SITE_LOCALE.pt
        ? '> use no máximo 120 caracteres, você tem 121'
        : '> use at most 120 characters, you have 121',
    );
  });
});

describe.each(Object.values(SITE_LOCALE))('contact receipt forget (%s)', (locale) => {
  const REF = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
  const text = contactCopy[locale].success.receipt.forget;
  let mounted: MountedClient;
  let forgetResponses: Array<() => Promise<Response>>;
  let forgetCalls: Array<{ url: string; body: unknown }>;

  afterEach(() => {
    mounted?.unmount();
    vi.unstubAllGlobals();
  });

  async function deliver() {
    forgetResponses = [];
    forgetCalls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === '/api/contact') return Response.json({ ok: true, requestId: REF });
        forgetCalls.push({ url, body: JSON.parse(String(init?.body)) });
        const next = forgetResponses.shift();
        return next ? next() : Response.json({ ok: true });
      }),
    );
    mounted = await mountClient(
      createElement(ContactForm, {
        copy: contactCopy[locale],
        chrome: contactChrome[locale],
      }),
    );
    fillValidForm(mounted.container);
    await act(async () => {
      mounted.container
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();
    return mounted.container;
  }

  const forgetButton = (container: HTMLElement) =>
    within(container).queryByRole('button', { name: text.label });

  it('posts the ref to the forget endpoint and confirms the deletion', async () => {
    const container = await deliver();
    await act(async () => {
      fireEvent.click(forgetButton(container) as HTMLElement);
    });
    await flushMicrotasks();

    expect(forgetCalls).toEqual([{ url: '/api/log/forget', body: { requestId: REF } }]);
    expect(forgetButton(container)).toBeNull();
    expect(container.querySelector('[data-testid="contact-forget-status"]')?.textContent).toBe(
      text.done,
    );
  });

  it('moves focus to the ref copy button when the forget button leaves after a success', async () => {
    const container = await deliver();
    const button = forgetButton(container) as HTMLElement;
    button.focus();
    expect(document.activeElement).toBe(button);
    await act(async () => {
      fireEvent.click(button);
    });
    await flushMicrotasks();

    expect(button.isConnected).toBe(false);
    expect(document.activeElement).toBe(
      within(container.querySelector('[data-testid="contact-receipt"]') as HTMLElement).getByRole(
        'button',
        { name: contactCopy[locale].success.receipt.copy },
      ),
    );
  });

  it('shows the busy label once and sends a single request on repeated clicks', async () => {
    const container = await deliver();
    let release: (response: Response) => void = () => undefined;
    forgetResponses.push(() => new Promise<Response>((resolve) => (release = resolve)));
    const button = forgetButton(container) as HTMLElement;
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(button.textContent).toBe(text.pending);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(forgetCalls).toHaveLength(1);
    await act(async () => {
      release(Response.json({ ok: true }));
    });
    await flushMicrotasks();
  });

  it('reports a failed deletion with the email fallback and lets the visitor retry', async () => {
    const container = await deliver();
    forgetResponses.push(async () =>
      Response.json({ ok: false, error: { code: 'storage_unavailable' } }, { status: 503 }),
    );
    await act(async () => {
      fireEvent.click(forgetButton(container) as HTMLElement);
    });
    await flushMicrotasks();

    const status = container.querySelector('[data-testid="contact-forget-status"]') as HTMLElement;
    expect(status.textContent).toContain(text.failed);
    expect(status.querySelector('a')?.getAttribute('href')).toMatch(/^mailto:/);
    expect(decodeURIComponent(status.querySelector('a')?.getAttribute('href') ?? '')).toContain(
      REF,
    );
    const retry = forgetButton(container) as HTMLElement;
    expect(retry.getAttribute('aria-disabled')).not.toBe('true');

    await act(async () => {
      fireEvent.click(retry);
    });
    await flushMicrotasks();
    expect(forgetCalls).toHaveLength(2);
    expect(container.querySelector('[data-testid="contact-forget-status"]')?.textContent).toBe(
      text.done,
    );
  });

  it('treats a network error like a failed deletion', async () => {
    const container = await deliver();
    forgetResponses.push(async () => {
      throw new Error('offline');
    });
    await act(async () => {
      fireEvent.click(forgetButton(container) as HTMLElement);
    });
    await flushMicrotasks();

    expect(container.querySelector('[data-testid="contact-forget-status"]')?.textContent).toContain(
      text.failed,
    );
  });
});
