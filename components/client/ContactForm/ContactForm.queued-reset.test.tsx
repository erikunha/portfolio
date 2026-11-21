import { act, renderHook } from '@testing-library/react';
import type { FormEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contactCopy } from '@/content/contact-copy';
import type { ContactField } from '@/content/contact-rules';
import { clearRefs } from '@/lib/request-refs.client';
import {
  ContactIslandProvider,
  useMessageStore,
} from '../ContactIsland/ContactIslandProvider.client';
import { messageStore as singleton } from './messageStore';
import { CONTACT_STATUS, useContactSubmit } from './useContactSubmit';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const VALUES: Record<ContactField, string> = {
  name: 'Ada',
  email: 'ada@example.com',
  message: 'A platform engineering opportunity.',
};
const ACCEPTED = 202;

afterEach(() => {
  singleton.reset();
  clearRefs();
  vi.unstubAllGlobals();
});

describe('queued contact submit', () => {
  it('empties the provider message store and leaves the module singleton alone', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { ok: false, requestId: 'q-1', error: { code: 'queued', message: 'Saved for retry' } },
          { status: ACCEPTED },
        ),
      ),
    );
    const hook = renderHook(
      () => ({
        submit: useContactSubmit({ copy: contactCopy.en, values: VALUES, honeypot: '' }),
        store: useMessageStore(),
      }),
      { wrapper: ContactIslandProvider },
    );
    expect(hook.result.current.store).not.toBe(singleton);
    act(() => {
      hook.result.current.store.set(VALUES.message);
      singleton.set('singleton text');
    });
    expect(hook.result.current.store.getSnapshot()).toBe(VALUES.message);

    await act(async () => {
      await hook.result.current.submit.submit({ preventDefault: vi.fn() } as unknown as FormEvent);
    });

    expect(hook.result.current.submit.status).toBe(CONTACT_STATUS.QUEUED);
    expect(hook.result.current.store.getSnapshot()).toBe('');
    expect(singleton.getSnapshot()).toBe('singleton text');
  });
});
