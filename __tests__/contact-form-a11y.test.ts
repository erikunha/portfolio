// __tests__/contact-form-a11y.test.ts
// Coverage gap (CG3 Task 3.4): ContactForm accessibility contract.
//
// Renders the real ContactForm into jsdom and asserts:
//   - every visible field is reachable in source/tab order, and the honeypot
//     is removed from the tab sequence (tabIndex=-1 + aria-hidden);
//   - the submit control is a real <button type="submit"> so Enter / Space
//     activate it without JS;
//   - submitting via the keyboard path triggers the request;
//   - the error region is announced (role="alert") and the submit row is an
//     aria-live region.

import { act, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContactForm } from '@/components/client/ContactForm';
import { flushMicrotasks, type MountedClient, mountClient } from './helpers/render';

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
    // The three real fields are standard form controls — naturally focusable
    // and in DOM/tab order. None carry a negative tabindex.
    const name = container.querySelector<HTMLInputElement>('input[autocomplete="name"]');
    const email = container.querySelector<HTMLInputElement>('input[type="email"]');
    const message = container.querySelector<HTMLTextAreaElement>('textarea');

    expect(name).not.toBeNull();
    expect(email).not.toBeNull();
    expect(message).not.toBeNull();
    for (const field of [name, email, message]) {
      // A field is keyboard-reachable when it has no negative tabindex.
      const ti = field?.getAttribute('tabindex');
      expect(ti === null || Number(ti) >= 0).toBe(true);
    }

    // Source order is name → email → message (the natural Tab progression).
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
    // A keyboard / screen-reader user must skip the honeypot entirely.
    expect(honeypot?.getAttribute('tabindex')).toBe('-1');
    expect(honeypot?.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses a real submit button so Enter/Space activate it without JS', async () => {
    const container = await renderForm();
    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submit).not.toBeNull();
    // Native <button type=submit> is keyboard-operable by default — no
    // negative tabindex, no role override needed.
    expect(submit?.getAttribute('tabindex')).not.toBe('-1');
  });

  it('the submit row is an aria-live region', async () => {
    const container = await renderForm();
    const submitRow = container.querySelector('[aria-live="polite"]');
    expect(submitRow?.getAttribute('aria-live')).toBe('polite');
  });

  it('keyboard form submission triggers the request and announces errors via role="alert"', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: 'server boom' }), { status: 500 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const container = await renderForm();

    // No alert region while idle.
    expect(container.querySelector('[role="alert"]')).toBeNull();

    // Submitting the form (the path a keyboard user triggers by pressing Enter
    // in a field or activating the submit button) fires the request.
    const form = container.querySelector<HTMLFormElement>('form');
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

    // The failure is announced through an assertive live region.
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('server boom');
  });
});
