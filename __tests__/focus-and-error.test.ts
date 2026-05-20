// __tests__/focus-and-error.test.ts
// Behavioral test (CG3): renders the real ContactForm and asserts its error
// region carries role="alert" through the committed DOM, instead of grepping
// the component source for the string literal.
//
// The :focus-visible CSS rule is a build asset — jsdom does not evaluate the
// :focus-visible pseudo-class or paint focus rings, so the shipped stylesheet
// rule's presence is the strongest verifiable signal. That single read is
// tagged behavioral-test-allow.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('contact form error region', () => {
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

  it('renders the error message in a role="alert" live region after a failed submit', async () => {
    const { createElement } = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { ContactForm } = await import('@/components/client/ContactForm');

    // Make the contact POST fail so the form enters its error state.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'boom' }), { status: 500 })),
    );

    root = createRoot(container);
    await act(async () => {
      root.render(createElement(ContactForm));
    });

    // Idle state: no alert region present yet.
    expect(container.querySelector('[role="alert"]')).toBeNull();

    const form = container.querySelector<HTMLFormElement>('form.contact');
    expect(form).not.toBeNull();
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    // Error state: the error paragraph is announced via role="alert".
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('boom');
  });
});

describe('focus rings', () => {
  it('_base.css ships a button:focus-visible rule', () => {
    // behavioral-test-allow: reads the shipped stylesheet build asset; jsdom cannot evaluate :focus-visible
    const base = readFileSync(path.resolve(__dirname, '../app/css/_base.css'), 'utf-8');
    expect(base).toMatch(/button:focus-visible/);
  });
});
