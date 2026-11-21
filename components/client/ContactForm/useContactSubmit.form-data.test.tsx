import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contactCopy } from '@/content/contact-copy';
import { CONTACT_FIELD } from '@/content/contact-rules';
import { messageStore } from './messageStore';
import {
  CONTACT_FIELDS,
  CONTACT_HONEYPOT_FIELD,
  CONTACT_STATUS,
  useContactSubmit,
} from './useContactSubmit';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const copy = contactCopy.en;
const EMPTY = { name: '', email: '', message: '' };
const TYPED = {
  [CONTACT_FIELD.NAME]: 'Ada',
  [CONTACT_FIELD.EMAIL]: 'ada@example.com',
  [CONTACT_FIELD.MESSAGE]: 'A platform engineering opportunity.',
};

function formData(entries: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.set(name, value);
  return data;
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>) {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(String(init.body)) as Record<string, string>;
}

afterEach(() => {
  messageStore.reset();
  vi.unstubAllGlobals();
});

describe('useContactSubmit submitFromFormData', () => {
  it('sends the fields of the form data, not the values the hook was rendered with', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true, requestId: 'r-1' }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useContactSubmit({ copy, values: EMPTY, honeypot: '' }));

    await act(async () => {
      await result.current.submitFromFormData(formData({ ...TYPED, [CONTACT_HONEYPOT_FIELD]: '' }));
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(sentBody(fetchMock)).toEqual({ ...TYPED, [CONTACT_HONEYPOT_FIELD]: '' });
    expect(result.current.status).toBe(CONTACT_STATUS.SUCCESS);
  });

  it('carries the honeypot of the form data', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useContactSubmit({ copy, values: EMPTY, honeypot: '' }));
    await act(async () => {
      await result.current.submitFromFormData(
        formData({ ...TYPED, [CONTACT_HONEYPOT_FIELD]: 'Acme' }),
      );
    });
    expect(sentBody(fetchMock)[CONTACT_HONEYPOT_FIELD]).toBe('Acme');
  });

  it('validates the form data, shows every error and sends nothing', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useContactSubmit({ copy, values: EMPTY, honeypot: '' }));

    await act(async () => {
      await result.current.submitFromFormData(new FormData());
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(Object.keys(result.current.errors).sort()).toEqual([...CONTACT_FIELDS].sort());
    expect(result.current.status).toBe(CONTACT_STATUS.ERROR);
    expect(result.current.failureCount).toBe(1);
  });

  it('treats a file entry as an empty field', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() =>
      useContactSubmit({ copy, values: { ...TYPED }, honeypot: '' }),
    );
    const data = formData(TYPED);
    data.set(CONTACT_FIELD.NAME, new File(['x'], 'x.txt'));

    await act(async () => {
      await result.current.submitFromFormData(data);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(Object.keys(result.current.errors)).toEqual([CONTACT_FIELD.NAME]);
  });
});
