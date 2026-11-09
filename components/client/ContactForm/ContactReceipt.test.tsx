import { fireEvent, within } from '@testing-library/react';
import { act, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE } from '@/content/site-locale';
import { addRef, clearRefs, listRefs } from '@/lib/request-refs.client';
import { ContactReceipt } from './ContactReceipt';

const REF = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
const AT = new Date('2026-11-08T12:42:00Z');
const copy = contactCopy[SITE_LOCALE.en];
const text = copy.success.receipt;

describe('ContactReceipt', () => {
  let mounted: MountedClient | undefined;

  async function open(reply: () => Promise<Response> = async () => Response.json({ ok: true })) {
    const fetchMock = vi.fn(reply);
    vi.stubGlobal('fetch', fetchMock);
    mounted = await mountClient(
      createElement(ContactReceipt, { copy, receipt: { ref: REF, at: AT } }),
    );
    const container = mounted.container;
    return {
      container,
      fetchMock,
      forgetButton: () => within(container).queryByRole('button', { name: text.forget.label }),
      copyButton: () => within(container).getByRole('button', { name: text.copy }),
      status: () => container.querySelector('[data-testid="contact-forget-status"]') as HTMLElement,
    };
  }

  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
    vi.unstubAllGlobals();
    clearRefs();
  });

  it('shows the ref, a machine-readable send time and the forget control', async () => {
    const view = await open();
    expect(view.container.querySelector('.ref-chip-id')?.textContent).toBe(REF);
    expect(view.container.querySelector('time')?.getAttribute('datetime')).toBe(AT.toISOString());
    expect(view.forgetButton()).not.toBeNull();
    expect(view.status().textContent).toBe('');
  });

  it('moves focus to the copy button when the focused forget button leaves after a success', async () => {
    const view = await open();
    const button = view.forgetButton() as HTMLElement;
    button.focus();
    expect(document.activeElement).toBe(button);

    await act(async () => {
      fireEvent.click(button);
    });
    await flushMicrotasks();

    expect(button.isConnected).toBe(false);
    expect(document.activeElement).toBe(view.copyButton());
    expect(view.status().textContent).toBe(text.forget.done);
  });

  it('leaves focus alone when the forget button was not focused', async () => {
    const view = await open();
    const button = view.forgetButton() as HTMLElement;
    const other = document.createElement('button');
    document.body.appendChild(other);
    other.focus();

    await act(async () => {
      fireEvent.click(button);
    });
    await flushMicrotasks();

    expect(document.activeElement).toBe(other);
    other.remove();
  });

  it('keeps the forget button and its focus when the request fails, with a mail fallback', async () => {
    const view = await open(async () => new Response(null, { status: 500 }));
    const button = view.forgetButton() as HTMLElement;
    button.focus();

    await act(async () => {
      fireEvent.click(button);
    });
    await flushMicrotasks();

    expect(view.forgetButton()).toBe(button);
    expect(document.activeElement).toBe(button);
    const link = view.status().querySelector<HTMLAnchorElement>('a[href^="mailto:"]');
    expect(link?.textContent).toBe(copy.section.email);
    expect(link?.getAttribute('href')).toContain(
      encodeURIComponent(`${text.forgetSubject} ${REF}`),
    );
  });

  it('sends one request for repeated clicks and shows the pending label', async () => {
    let release: (response: Response) => void = () => undefined;
    const view = await open(() => new Promise<Response>((resolve) => (release = resolve)));
    const button = view.forgetButton() as HTMLElement;
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(view.fetchMock).toHaveBeenCalledTimes(1);
    expect(button.textContent).toBe(text.forget.pending);
    expect(button.getAttribute('aria-disabled')).toBe('true');

    await act(async () => {
      release(Response.json({ ok: true }));
    });
    await flushMicrotasks();
  });

  it('drops the ref from the stored list once it is forgotten', async () => {
    addRef(REF);
    const view = await open();
    await act(async () => {
      fireEvent.click(view.forgetButton() as HTMLElement);
    });
    await flushMicrotasks();
    expect(listRefs()).not.toContain(REF);
  });
});
