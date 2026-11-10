import { act, renderHook } from '@testing-library/react';
import type { FormEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contactCopy } from '@/content/contact-copy';
import { CONTACT_ERROR_CODE, type ContactField } from '@/content/contact-rules';
import { clearRefs, listRefs } from '@/lib/request-refs.client';
import { ASK_LOCALE_HEADER } from '@/lib/stream-protocol';
import { messageStore } from './messageStore';
import { CONTACT_STATUS, useContactSubmit } from './useContactSubmit';

const pathname = vi.hoisted(() => ({ current: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

const copy = contactCopy.en;
const REF = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
const HEADER_REF = 'b1c2d3e4-0000-4000-8000-000000000001';
const VALID: Record<ContactField, string> = {
  name: 'Ada',
  email: 'ada@example.com',
  message: 'A platform engineering opportunity.',
};
const submitEvent = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent;

function mount(values: Record<ContactField, string> = VALID, honeypot = '') {
  return renderHook(() => useContactSubmit({ copy, values, honeypot }));
}

async function send(hook: ReturnType<typeof mount>) {
  await act(async () => {
    await hook.result.current.submit(submitEvent());
  });
}

function reply(body: unknown, init: ResponseInit = {}) {
  const fetchMock = vi.fn(async () => Response.json(body, init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  pathname.current = '/';
  window.sessionStorage.clear();
  clearRefs();
});

afterEach(() => {
  messageStore.reset();
  vi.unstubAllGlobals();
});

describe('useContactSubmit', () => {
  it('starts idle with nothing to show', () => {
    const { result } = mount();
    expect(result.current.status).toBe(CONTACT_STATUS.IDLE);
    expect(result.current.busy).toBe(false);
    expect(result.current.errors).toEqual({});
    expect(result.current.errorMsg).toBe('');
    expect(result.current.receipt).toBeNull();
    expect(result.current.failureCount).toBe(0);
  });

  describe('validation', () => {
    it('reports every invalid field, counts the failure and sends nothing', async () => {
      const fetchMock = reply({ ok: true });
      const hook = mount({ name: '', email: 'nope', message: 'short' });
      await send(hook);

      expect(hook.result.current.status).toBe(CONTACT_STATUS.ERROR);
      expect(Object.keys(hook.result.current.errors).sort()).toEqual(['email', 'message', 'name']);
      expect(hook.result.current.failureCount).toBe(1);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('counts each rejected attempt', async () => {
      const hook = mount({ ...VALID, name: '' });
      await send(hook);
      await send(hook);
      expect(hook.result.current.failureCount).toBe(2);
    });

    it('prevents the native submit', async () => {
      reply({ ok: true, requestId: REF });
      const hook = mount();
      const event = submitEvent();
      await act(async () => {
        await hook.result.current.submit(event);
      });
      expect(event.preventDefault).toHaveBeenCalledOnce();
    });
  });

  describe('delivery', () => {
    it('stores the receipt and the ref when the API answers ok', async () => {
      const fetchMock = reply({ ok: true, requestId: REF });
      const hook = mount();
      await send(hook);

      expect(hook.result.current.status).toBe(CONTACT_STATUS.SUCCESS);
      expect(hook.result.current.receipt?.ref).toBe(REF);
      expect(hook.result.current.receipt?.at).toBeInstanceOf(Date);
      expect(listRefs()).toContain(REF);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe('/api/contact');
      expect(JSON.parse(String(init.body))).toEqual({ ...VALID, field_company: '' });
    });

    it('sends the honeypot value as field_company', async () => {
      const fetchMock = reply({ ok: true, requestId: REF });
      const hook = mount(VALID, 'Acme');
      await send(hook);
      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(JSON.parse(String(init.body)).field_company).toBe('Acme');
    });

    it('falls back to the response header when the body has no request id', async () => {
      reply({ ok: true }, { headers: { 'X-Request-Id': HEADER_REF } });
      const hook = mount();
      await send(hook);
      expect(hook.result.current.receipt?.ref).toBe(HEADER_REF);
    });

    it('shows success without a receipt when no ref came back', async () => {
      reply({ ok: true });
      const hook = mount();
      await send(hook);
      expect(hook.result.current.status).toBe(CONTACT_STATUS.SUCCESS);
      expect(hook.result.current.receipt).toBeNull();
    });

    it('clears the stored draft after a delivery', async () => {
      reply({ ok: true, requestId: REF });
      messageStore.seed('draft text');
      const hook = mount();
      await send(hook);
      expect(messageStore.getSnapshot()).toBe('');
    });
  });

  describe('202 queued', () => {
    const queued = { ok: false, requestId: REF, error: { code: 'queued', message: 'queued' } };

    it('moves to the queued state and clears the draft', async () => {
      reply(queued, { status: 202 });
      messageStore.seed('draft text');
      const hook = mount();
      await send(hook);

      expect(hook.result.current.status).toBe(CONTACT_STATUS.QUEUED);
      expect(hook.result.current.receipt).toBeNull();
      expect(hook.result.current.errorMsg).toBe('');
      expect(messageStore.getSnapshot()).toBe('');
      expect(listRefs()).toContain(REF);
    });

    it('treats a 202 that is not the queued code as a failure', async () => {
      reply({ ok: true, requestId: REF }, { status: 202 });
      const hook = mount();
      await send(hook);
      expect(hook.result.current.status).toBe(CONTACT_STATUS.ERROR);
      expect(hook.result.current.errorMsg).toBe(copy.errors.requestFailed);
    });
  });

  describe('dismiss', () => {
    it('returns to idle so the visitor can write another message', async () => {
      reply(
        { ok: false, requestId: REF, error: { code: 'queued', message: 'queued' } },
        { status: 202 },
      );
      const hook = mount();
      await send(hook);
      expect(hook.result.current.status).toBe(CONTACT_STATUS.QUEUED);

      act(() => hook.result.current.dismiss());

      expect(hook.result.current.status).toBe(CONTACT_STATUS.IDLE);
      expect(hook.result.current.busy).toBe(false);
      expect(hook.result.current.errorMsg).toBe('');
      expect(hook.result.current.errorRef).toBe('');
      expect(hook.result.current.receipt).toBeNull();
    });
  });

  describe('ok:false mapping', () => {
    it.each([
      [CONTACT_ERROR_CODE.RATE_LIMITED, 429, copy.errors.rateLimited],
      [CONTACT_ERROR_CODE.STORAGE_UNAVAILABLE, 503, copy.errors.storageUnavailable],
      [CONTACT_ERROR_CODE.DELIVERY_UNAVAILABLE, 502, copy.errors.retryUnavailable],
      [CONTACT_ERROR_CODE.FORBIDDEN_ORIGIN, 403, copy.errors.forbiddenOrigin],
      ['internal_error', 500, copy.errors.requestFailed],
    ])('maps %s to its page-language message', async (code, status, message) => {
      reply({ ok: false, requestId: REF, error: { code, message: 'server text' } }, { status });
      const hook = mount();
      await send(hook);

      expect(hook.result.current.status).toBe(CONTACT_STATUS.ERROR);
      expect(hook.result.current.errorMsg).toBe(message);
      expect(hook.result.current.errorRef).toBe(REF);
      expect(hook.result.current.failureCount).toBe(1);
    });

    it('treats an ok status with ok:false as a failure', async () => {
      reply({ ok: false, error: { code: CONTACT_ERROR_CODE.RATE_LIMITED } }, { status: 200 });
      const hook = mount();
      await send(hook);
      expect(hook.result.current.errorMsg).toBe(copy.errors.rateLimited);
    });

    it('reports a body that is not JSON as a generic failure', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('<html>', { status: 502 })),
      );
      const hook = mount();
      await send(hook);
      expect(hook.result.current.errorMsg).toBe(copy.errors.requestFailed);
    });

    it('reports a network failure as a generic failure', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new TypeError('network');
        }),
      );
      const hook = mount();
      await send(hook);
      expect(hook.result.current.status).toBe(CONTACT_STATUS.ERROR);
      expect(hook.result.current.errorMsg).toBe(copy.errors.requestFailed);
      expect(hook.result.current.errorRef).toBe('');
    });

    it('clears the previous failure when the next attempt starts', async () => {
      reply({ ok: false, requestId: REF, error: { code: 'internal_error' } }, { status: 500 });
      const hook = mount();
      await send(hook);
      expect(hook.result.current.errorRef).toBe(REF);

      reply({ ok: true, requestId: HEADER_REF });
      await send(hook);
      expect(hook.result.current.errorMsg).toBe('');
      expect(hook.result.current.errorRef).toBe('');
      expect(hook.result.current.status).toBe(CONTACT_STATUS.SUCCESS);
    });
  });

  describe('double-submit guard', () => {
    it('sends one request while the first is still pending', async () => {
      let release: (response: Response) => void = () => undefined;
      const fetchMock = vi.fn(() => new Promise<Response>((resolve) => (release = resolve)));
      vi.stubGlobal('fetch', fetchMock);
      const hook = mount();

      let first: Promise<void> = Promise.resolve();
      await act(async () => {
        first = hook.result.current.submit(submitEvent());
      });
      expect(hook.result.current.busy).toBe(true);
      expect(hook.result.current.status).toBe(CONTACT_STATUS.SUBMITTING);

      await act(async () => {
        await hook.result.current.submit(submitEvent());
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        release(Response.json({ ok: true, requestId: REF }));
        await first;
      });
      expect(hook.result.current.status).toBe(CONTACT_STATUS.SUCCESS);
    });

    it('accepts a new send after the previous one failed', async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('network'))
        .mockResolvedValueOnce(Response.json({ ok: true, requestId: REF }));
      vi.stubGlobal('fetch', fetchMock);
      const hook = mount();
      await send(hook);
      await send(hook);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(hook.result.current.status).toBe(CONTACT_STATUS.SUCCESS);
    });

    it('keeps the in-flight status when a field is edited during the send', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => new Promise<Response>(() => undefined)),
      );
      const hook = mount();
      await act(async () => {
        void hook.result.current.submit(submitEvent());
      });
      act(() => hook.result.current.noteEdit('name', 'Grace'));
      expect(hook.result.current.status).toBe(CONTACT_STATUS.SUBMITTING);
    });
  });

  describe('locale header', () => {
    it.each([
      ['/', 'en'],
      ['/pt', 'pt'],
      ['/pt/cv', 'pt'],
      ['/cv', 'en'],
    ])('sends %s as %s', async (path, locale) => {
      pathname.current = path;
      const fetchMock = reply({ ok: true, requestId: REF });
      const hook = mount();
      await send(hook);
      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect((init.headers as Record<string, string>)[ASK_LOCALE_HEADER]).toBe(locale);
    });
  });

  describe('editing after a failure', () => {
    async function failedWithInvalidName() {
      const hook = mount({ ...VALID, name: '' });
      await send(hook);
      return hook;
    }

    it('keeps an error while the edited value is still invalid', async () => {
      const hook = await failedWithInvalidName();
      act(() => hook.result.current.noteEdit('name', ''));
      expect(hook.result.current.errors.name).toBeDefined();
    });

    it('drops the error as soon as the edited value is valid', async () => {
      const hook = await failedWithInvalidName();
      act(() => hook.result.current.noteEdit('name', 'Ada'));
      expect(hook.result.current.errors.name).toBeUndefined();
    });

    it('returns to idle and clears the request error', async () => {
      reply({ ok: false, error: { code: CONTACT_ERROR_CODE.RATE_LIMITED } }, { status: 429 });
      const hook = mount();
      await send(hook);
      expect(hook.result.current.errorMsg).not.toBe('');
      act(() => hook.result.current.noteEdit('message', 'A different message entirely.'));
      expect(hook.result.current.status).toBe(CONTACT_STATUS.IDLE);
      expect(hook.result.current.errorMsg).toBe('');
    });
  });

  describe('message error follows the shared store', () => {
    it('drops the message error once the message value becomes valid', async () => {
      const hook = renderHook(
        ({ message }) => useContactSubmit({ copy, values: { ...VALID, message }, honeypot: '' }),
        { initialProps: { message: 'short' } },
      );
      await act(async () => {
        await hook.result.current.submit(submitEvent());
      });
      expect(hook.result.current.errors.message).toBeDefined();

      hook.rerender({ message: 'A long enough message now.' });
      expect(hook.result.current.errors.message).toBeUndefined();
    });

    it('keeps the message error while the value is still too short', async () => {
      const hook = renderHook(
        ({ message }) => useContactSubmit({ copy, values: { ...VALID, message }, honeypot: '' }),
        { initialProps: { message: 'short' } },
      );
      await act(async () => {
        await hook.result.current.submit(submitEvent());
      });
      hook.rerender({ message: 'tiny' });
      expect(hook.result.current.errors.message).toBeDefined();
    });
  });
});
