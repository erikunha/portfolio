import { fireEvent, within } from '@testing-library/react';
import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { contactChrome } from '@/content/terminal-chrome';
import { clearRefs, listRefs } from '@/lib/request-refs.client';
import { ContactForm } from './ContactForm';
import { messageStore } from './messageStore';

const REF = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
const MESSAGE = 'A platform engineering opportunity.';

function fillValidForm(container: HTMLElement) {
  fireEvent.change(container.querySelector('input[name="name"]') as HTMLInputElement, {
    target: { value: 'Ada' },
  });
  fireEvent.change(container.querySelector('input[name="email"]') as HTMLInputElement, {
    target: { value: 'ada@example.com' },
  });
  fireEvent.change(container.querySelector('textarea') as HTMLTextAreaElement, {
    target: { value: MESSAGE },
  });
}

describe('contact request refs', () => {
  let mounted: MountedClient | undefined;

  async function submit(reply: () => Promise<Response>, locale: SiteLocale = SITE_LOCALE.en) {
    vi.stubGlobal('fetch', vi.fn(reply));
    mounted = await mountClient(
      createElement(ContactForm, { copy: contactCopy[locale], chrome: contactChrome[locale] }),
    );
    const container = mounted.container;
    fillValidForm(container);
    await act(async () => {
      container
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flushMicrotasks();
    return container;
  }

  beforeEach(() => {
    window.sessionStorage.clear();
    clearRefs();
  });
  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
    messageStore.reset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('R5 email fallback on a failed send', () => {
    const failure =
      (body: unknown, status = 502, headers: Record<string, string> = {}) =>
      async () =>
        Response.json(body, { status, headers });
    const errorBody = (requestId?: string) => ({
      ok: false,
      ...(requestId ? { requestId } : {}),
      error: { code: 'internal_error', message: 'boom' },
    });

    it('puts the 8-char ref in the subject and the full ref plus the visitor text in the body', async () => {
      const container = await submit(failure(errorBody(REF)));
      const alert = container.querySelector('[role="alert"]') as HTMLElement;
      const link = alert.querySelector<HTMLAnchorElement>('a[href^="mailto:"]');
      const url = new URL(link?.getAttribute('href') ?? '');
      expect(url.pathname).toBe(contactCopy.en.section.email);
      expect(url.searchParams.get('subject')).toBe(`[ref ${REF.slice(0, 8)}] contact`);
      const body = url.searchParams.get('body') ?? '';
      expect(body).toContain(REF);
      expect(body).toContain(MESSAGE);
    });

    it('shows the full ref in a chip the visitor can copy', async () => {
      const container = await submit(failure(errorBody(REF)));
      const alert = container.querySelector('[role="alert"]') as HTMLElement;
      expect(alert.querySelector('.ref-chip code')?.textContent).toBe(REF);
      expect(within(alert).getAllByRole('button').length).toBeGreaterThan(0);
    });

    it('reads the ref from the X-Request-Id header when the body is not JSON', async () => {
      const container = await submit(
        async () =>
          new Response('<html>bad gateway</html>', {
            status: 502,
            headers: { 'X-Request-Id': REF },
          }),
      );
      const link = container.querySelector<HTMLAnchorElement>('[role="alert"] a[href^="mailto:"]');
      expect(new URL(link?.getAttribute('href') ?? '').searchParams.get('subject')).toContain(
        REF.slice(0, 8),
      );
    });

    it('falls back to a plain mailto with no ref when the request never reached the server', async () => {
      const container = await submit(async () => {
        throw new TypeError('offline');
      });
      const alert = container.querySelector('[role="alert"]') as HTMLElement;
      expect(alert.querySelector('.ref-chip')).toBeNull();
      expect(alert.querySelector('a[href^="mailto:"]')?.getAttribute('href')).toBe(
        `mailto:${contactCopy.en.section.email}`,
      );
    });

    it('words the subject and body in Portuguese on pt', async () => {
      const container = await submit(failure(errorBody(REF)), SITE_LOCALE.pt);
      const link = container.querySelector<HTMLAnchorElement>('[role="alert"] a[href^="mailto:"]');
      const url = new URL(link?.getAttribute('href') ?? '');
      expect(url.searchParams.get('subject')).toBe(`[ref ${REF.slice(0, 8)}] contato`);
      expect(url.searchParams.get('body')).toContain(REF);
    });

    it('does not list a failed send in the session refs', async () => {
      await submit(failure(errorBody(REF)));
      expect(listRefs()).toEqual([]);
    });
  });

  describe('R6 and R7 delivered and queued', () => {
    it('records the ref of a delivered message and keeps it out of the receipt', async () => {
      const container = await submit(async () => Response.json({ ok: true, requestId: REF }));
      expect(listRefs()).toEqual([REF]);
      const receipt = container.querySelector('[data-testid="contact-receipt"]') as HTMLElement;
      expect(receipt.textContent).not.toContain(REF);
      expect(receipt.querySelector('.ref-chip')).toBeNull();
      expect(within(receipt).queryAllByRole('button')).toHaveLength(0);
      expect(receipt.querySelector('a[href^="mailto:"]')).toBeNull();
    });

    it('records the ref of a queued message', async () => {
      await submit(async () =>
        Response.json(
          { ok: false, requestId: REF, error: { code: 'queued', message: 'saved' } },
          { status: 202 },
        ),
      );
      expect(listRefs()).toEqual([REF]);
    });
  });
});
