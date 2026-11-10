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
});
