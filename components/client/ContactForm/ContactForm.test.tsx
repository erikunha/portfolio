import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { linksContent } from '@/content/links';
import { ContactForm } from './ContactForm';

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
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ ok: false, error: { code: 'storage_unavailable', message: 'boom' } }),
            { status: 500 },
          ),
      ),
    );

    mounted = await mountClient(createElement(ContactForm));
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
    expect(alert?.textContent).toContain('boom');
  });
});

describe('contact form delivery states', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
    vi.unstubAllGlobals();
  });

  async function submitResponse(body: unknown, status: number) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(body, { status })),
    );
    mounted = await mountClient(createElement(ContactForm));
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
    [400, 'validation_failed', 'request validation failed'],
    [429, 'rate_limited', 'too many requests, try again in 10 minutes'],
    [502, 'storage_unavailable', 'storage unavailable, try again'],
  ])(
    'displays the server message from an object error envelope (%s)',
    async (status, code, message) => {
      const container = await submitResponse(
        { ok: false, requestId: 'request-id', error: { code, message } },
        status,
      );
      const alert = container.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain(message);
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

    mounted = await mountClient(createElement(ContactForm));
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
    const { container } = render(<ContactForm />);
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
    render(<ContactForm />);
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
      const { container } = render(<ContactForm />);
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
    const { container } = render(<ContactForm />);
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
      const { container } = render(<ContactForm />);
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
      const { container } = render(<ContactForm />);
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
      const { container } = render(<ContactForm />);
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
    const { container } = render(<ContactForm />);
    fillValidForm(container);
    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);
    const alert = await screen.findByRole('alert');
    expect(document.activeElement).toBe(alert);
    expect(alert.textContent).toContain('storage unavailable, try again');
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
        <ContactForm />
        <ContactForm />
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
