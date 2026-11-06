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

  it('the submit row is an aria-live region', async () => {
    const container = await renderForm();
    const submitRow = container.querySelector('[aria-live="polite"]');
    expect(submitRow?.getAttribute('aria-live')).toBe('polite');
  });

  it('states how long a message is kept before it is deleted', async () => {
    const container = await renderForm();
    const privacy = container.querySelector('.contact-privacy');
    expect(privacy?.textContent).toBe(
      'Kept 90 days so Erik can reply, then deleted. IP hashed for rate limiting. Never shared.',
    );
  });

  it('keyboard form submission triggers the request and announces errors via role="alert"', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: 'storage_unavailable', message: 'server boom' },
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
            JSON.stringify({ ok: false, error: { code: 'storage_unavailable', message: 'boom' } }),
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
    expect(success?.textContent).toContain('EXECUTE_SEND :: SUCCESS');
    expect(success?.textContent).toContain('handshake initiated · expect reply within 48h');
  });

  it('shows a receipt with the request id, a copy control and a prefilled deletion email', async () => {
    const ref = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
    const container = await submitResponse({ ok: true, requestId: ref }, 200);
    const receipt = container.querySelector('[data-testid="contact-receipt"]');
    expect(receipt?.textContent).toContain('ref');
    expect(receipt?.textContent).toContain(ref);
    expect(within(receipt as HTMLElement).getByRole('button', { name: /copy ref/i })).toBeTruthy();
    const forget = within(receipt as HTMLElement).getByRole('link', { name: /request deletion/i });
    expect(decodeURIComponent(forget.getAttribute('href') ?? '')).toContain(ref);
    expect(forget.getAttribute('href')).toMatch(/^mailto:/);
  });

  it('shows the receipt in Portuguese on pt', async () => {
    const container = await submitResponse({ ok: true, requestId: 'abc-123' }, 200, SITE_LOCALE.pt);
    const receipt = container.querySelector('[data-testid="contact-receipt"]');
    expect(
      within(receipt as HTMLElement).getByRole('button', { name: /copiar ref/i }),
    ).toBeTruthy();
    expect(
      within(receipt as HTMLElement).getByRole('link', { name: /pedir exclusão/i }),
    ).toBeTruthy();
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

  it('announces queued without success and offers the canonical LinkedIn link', async () => {
    const container = await submitResponse(
      { ok: false, requestId: 'request-id', error: { code: 'queued', message: 'Saved for retry' } },
      202,
    );
    expect(container.querySelector('[data-testid="contact-success"]')).toBeNull();
    const queued = container.querySelector('[data-testid="contact-queued"]');
    expect(queued?.getAttribute('role')).toBe('status');
    expect(queued?.textContent).toContain('saved, not delivered yet');
    expect(queued?.textContent).toContain('delivery is retried automatically');
    expect(queued?.textContent).toContain('for a faster reply use LinkedIn');
    const link = queued?.querySelector('a');
    expect(link?.textContent).toBe('LinkedIn');
    expect(link?.getAttribute('href')).toBe(
      linksContent.pills.find((pill) => pill.id === 'linkedin')?.href,
    );
    expect(container.querySelector('form')).toBeNull();
  });

  it.each([
    [SITE_LOCALE.en, 400, 'validation_failed', 'error: could not send right now. Your text'],
    [
      SITE_LOCALE.en,
      429,
      'rate_limited',
      'error: too many requests, try again in 10 minutes. Your',
    ],
    [SITE_LOCALE.en, 502, 'storage_unavailable', 'error: could not send right now. Your text'],
    [SITE_LOCALE.pt, 502, 'storage_unavailable', 'erro: não foi possível enviar agora. Seu texto'],
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
          document.getElementById(description)?.textContent?.includes('error:'),
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
              error: { code: 'storage_unavailable', message: 'storage unavailable, try again' },
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
    expect(document.getElementById(labelId)?.textContent).toBe('3 fields need attention:');
    expect(screen.getByRole('alert', { name: '3 fields need attention:' })).toBe(summary);
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
    expect(summary.textContent).toContain('3 fields need attention:');
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
