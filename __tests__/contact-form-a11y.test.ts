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

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('ContactForm accessibility', () => {
  let container: HTMLElement;
  let root: import('react-dom/client').Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  async function renderForm(): Promise<void> {
    const { createElement } = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { ContactForm } = await import('@/components/client/ContactForm');
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(ContactForm));
    });
  }

  it('exposes name, email, and message inputs in the tab sequence', async () => {
    await renderForm();
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
    await renderForm();
    const honeypot = container.querySelector<HTMLInputElement>('[data-testid="contact-honeypot"]');
    expect(honeypot).not.toBeNull();
    // A keyboard / screen-reader user must skip the honeypot entirely.
    expect(honeypot?.getAttribute('tabindex')).toBe('-1');
    expect(honeypot?.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses a real submit button so Enter/Space activate it without JS', async () => {
    await renderForm();
    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submit).not.toBeNull();
    expect(submit?.textContent).toMatch(/execute_send/i);
    // Native <button type=submit> is keyboard-operable by default — no
    // negative tabindex, no role override needed.
    expect(submit?.getAttribute('tabindex')).not.toBe('-1');
  });

  it('the submit row is an aria-live region', async () => {
    await renderForm();
    const submitRow = container.querySelector('.contact__submitrow');
    expect(submitRow?.getAttribute('aria-live')).toBe('polite');
  });

  it('keyboard form submission triggers the request and announces errors via role="alert"', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: 'server boom' }), { status: 500 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await renderForm();

    // No alert region while idle.
    expect(container.querySelector('[role="alert"]')).toBeNull();

    // Submitting the form (the path a keyboard user triggers by pressing Enter
    // in a field or activating the submit button) fires the request.
    const form = container.querySelector<HTMLFormElement>('form.contact');
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0));
    });

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
