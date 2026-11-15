import { fireEvent } from '@testing-library/react';
import { act, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE } from '@/content/site-locale';
import { contactChrome } from '@/content/terminal-chrome';
import { ContactForm } from './ContactForm';
import { messageStore } from './messageStore';

const LOCALE = SITE_LOCALE.en;
const SERVER_ERROR_STATUS = 500;

let mounted: MountedClient | undefined;

afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
  messageStore.reset();
  vi.unstubAllGlobals();
});

async function open() {
  mounted = await mountClient(
    createElement(ContactForm, { copy: contactCopy[LOCALE], chrome: contactChrome[LOCALE] }),
  );
  const { container } = mounted;
  return {
    form: container.querySelector('form') as HTMLFormElement,
    name: container.querySelector('input[name="name"]') as HTMLInputElement,
    email: container.querySelector('input[name="email"]') as HTMLInputElement,
    message: container.querySelector('textarea') as HTMLTextAreaElement,
    summary: () => container.querySelector<HTMLElement>('[role="alert"]'),
  };
}

async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await flushMicrotasks();
}

describe('the failure summary takes focus on every failed submit', () => {
  it('refocuses the validation summary after focus moved to a field and the submit fails again', async () => {
    const { form, name, summary } = await open();

    await submit(form);
    expect(summary()).not.toBeNull();
    expect(document.activeElement).toBe(summary());

    act(() => name.focus());
    expect(document.activeElement).toBe(name);

    await submit(form);
    expect(document.activeElement).toBe(summary());
  });

  it('refocuses the request-failure summary after focus moved to a field and the send fails again', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(JSON.stringify({ ok: false }), { status: SERVER_ERROR_STATUS }),
      ),
    );
    const { form, name, email, message, summary } = await open();
    fireEvent.change(name, { target: { value: 'Ada' } });
    fireEvent.change(email, { target: { value: 'ada@example.com' } });
    fireEvent.change(message, { target: { value: 'A platform engineering opportunity.' } });

    await submit(form);
    expect(summary()).not.toBeNull();
    expect(document.activeElement).toBe(summary());

    act(() => name.focus());
    expect(document.activeElement).toBe(name);

    await submit(form);
    expect(document.activeElement).toBe(summary());
  });
});
