import { fireEvent } from '@testing-library/react';
import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE } from '@/content/site-locale';
import { contactChrome } from '@/content/terminal-chrome';
import { ContactForm } from './ContactForm';
import { messageStore } from './messageStore';

const LOCALE = SITE_LOCALE.en;
const REF = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
const HUNG_REQUEST_MS = 60_000;

function stallUntilAborted(init?: RequestInit): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () =>
      reject(new DOMException('The operation was aborted.', 'AbortError')),
    );
  });
}

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

describe('contact requests give up on a stalled connection', () => {
  let mounted: MountedClient;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    mounted?.unmount();
    messageStore.reset();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function open() {
    mounted = await mountClient(
      createElement(ContactForm, {
        copy: contactCopy[LOCALE],
        chrome: contactChrome[LOCALE],
      }),
    );
    fillValidForm(mounted.container);
    return mounted.container;
  }

  it('ends a send that never answers with the failed-send alert and a usable form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => stallUntilAborted(init)),
    );
    const container = await open();
    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(form.getAttribute('aria-busy')).toBe('true');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(HUNG_REQUEST_MS);
    });

    expect(
      container.querySelector('[role="alert"]'),
      'a send with no answer must surface the failed-send alert, not "sending" forever',
    ).not.toBeNull();
    expect(form.getAttribute('aria-busy')).toBe('false');
    expect(
      container.querySelector<HTMLInputElement>('input[name="name"]')?.readOnly,
      'the fields must unlock so the visitor can retry',
    ).toBe(false);
  });

  it('ends a forget request that never answers with the failed state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) =>
        url === '/api/contact'
          ? Promise.resolve(Response.json({ ok: true, requestId: REF }))
          : stallUntilAborted(init),
      ),
    );
    const container = await open();
    await act(async () => {
      container
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const forget = container.querySelector<HTMLButtonElement>(
      '.contact-receipt-actions button:last-of-type',
    );
    expect(forget).not.toBeNull();
    await act(async () => {
      fireEvent.click(forget as HTMLElement);
    });
    expect(forget?.getAttribute('aria-disabled')).toBe('true');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(HUNG_REQUEST_MS);
    });

    expect(
      container.querySelector('[data-testid="contact-forget-status"]')?.textContent,
      'a forget request with no answer must show the failed state and the email fallback',
    ).toContain(contactCopy[LOCALE].success.receipt.forget.failed);
    expect(forget?.getAttribute('aria-disabled')).toBe('false');
  });
});
