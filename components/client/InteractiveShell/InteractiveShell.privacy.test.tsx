import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, type MountedClient, mountClient } from '@/__tests__/helpers/render';
import SHELL_RESPONSES from '@/content/shell-commands';
import { shellStates, shellUi } from '@/content/shell-ui';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { shellChrome } from '@/content/terminal-chrome';

vi.mock('@/lib/use-breakpoint.client', () => ({ useBreakpoint: () => ({ isMobile: false }) }));
vi.mock('@/lib/motion', () => ({ readMotion: () => false }));

const A = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
const B = '0b9d11e4-7c2a-4f6e-8e0d-2a6b9f3c1d55';
const C = '3c1f0a58-9d2e-4b7a-8c61-5e7d2f9b4a10';
const FORGET_URL = '/api/log/forget';
const ui = shellUi[SITE_LOCALE.en];
const states = shellStates[SITE_LOCALE.en];

type Reply = { status: number; headers?: Record<string, string> };

function askReply(id: string | null, status = 200): Response {
  return new Response(status === 200 ? 'An answer.' : JSON.stringify({ error: 'nope' }), {
    status,
    headers: id ? { 'X-Request-Id': id } : {},
  });
}

function stubBackend(options: { asks?: (string | null)[]; forget?: Reply[] }) {
  const asks = [...(options.asks ?? [])];
  const forgets = [...(options.forget ?? [])];
  const forgetBodies: string[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === FORGET_URL) {
      forgetBodies.push(String(init?.body));
      const reply = forgets.shift() ?? { status: 200 };
      return Response.json({ ok: reply.status === 200 }, reply);
    }
    return askReply(asks.shift() ?? null);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, forgetBodies };
}

async function submit(container: HTMLElement, command: string) {
  const input = container.querySelector<HTMLInputElement>('input[name="command"]');
  const form = container.querySelector<HTMLFormElement>('form');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    if (input && setter) setter.call(input, command);
    input?.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => {
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await flushMicrotasks();
}

function feedLines(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.shell-feed .shell-line')].map(
    (line) => line.textContent ?? '',
  );
}

function button(container: HTMLElement, text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((b) => b.textContent === text);
  expect(found, `button ${text}`).toBeDefined();
  return found as HTMLButtonElement;
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
  await flushMicrotasks();
}

describe('shell trailer and privacy command', () => {
  let mounted: MountedClient | undefined;

  async function renderShell(locale: SiteLocale = SITE_LOCALE.en) {
    const { InteractiveShell } = await import('./InteractiveShell');
    mounted = await mountClient(
      createElement(InteractiveShell, {
        locale,
        ui: shellUi[locale],
        chrome: shellChrome[locale],
      }),
    );
    return mounted.container;
  }

  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('trailer', () => {
    it('ends an answer with a req= line holding the full id, copy and forget, and no token count', async () => {
      stubBackend({ asks: [A] });
      const container = await renderShell();
      await submit(container, 'what does erik do?');
      const trailer = container.querySelector('[data-testid="shell-reference"]');
      expect(trailer?.textContent).toContain(`-- req=${A}`);
      expect(trailer?.textContent).not.toMatch(/tokens/);
      expect(button(container, 'COPY')).toBeDefined();
      expect(button(container, 'FORGET')).toBeDefined();
    });

    it('forgets the request with one click, confirms in the trailer and announces it', async () => {
      const { forgetBodies } = stubBackend({ asks: [A], forget: [{ status: 200 }] });
      const container = await renderShell();
      await submit(container, 'q');
      await click(button(container, 'FORGET'));
      expect(forgetBodies).toEqual([JSON.stringify({ requestId: A })]);
      const trailer = container.querySelector('[data-testid="shell-reference"]');
      expect(trailer?.textContent).toContain(ui.forgetDeleted);
      expect(
        [...container.querySelectorAll('button')].some((b) => b.textContent === 'FORGET'),
      ).toBe(false);
      expect(container.querySelector('p[role="status"]')?.textContent).toContain(ui.forgetDeleted);
      await submit(container, 'privacy');
      expect(feedLines(container).at(-1)).toBe(ui.privacyEmpty);
    });

    it('keeps the forget button after a failure and succeeds on retry', async () => {
      const { forgetBodies } = stubBackend({
        asks: [A],
        forget: [{ status: 503 }, { status: 200 }],
      });
      const container = await renderShell();
      await submit(container, 'q');
      await click(button(container, 'FORGET'));
      const trailer = container.querySelector('[data-testid="shell-reference"]');
      expect(trailer?.textContent).toContain(ui.forgetFailed);
      await click(button(container, 'FORGET'));
      expect(forgetBodies).toHaveLength(2);
      expect(trailer?.textContent).toContain(ui.forgetDeleted);
    });

    it('shows how long to wait on a 429 and keeps the button', async () => {
      stubBackend({ asks: [A], forget: [{ status: 429, headers: { 'Retry-After': '120' } }] });
      const container = await renderShell();
      await submit(container, 'q');
      await click(button(container, 'FORGET'));
      const trailer = container.querySelector('[data-testid="shell-reference"]');
      expect(trailer?.textContent).toContain(`2 ${states.minutesUnit}`);
      expect(button(container, 'FORGET')).toBeDefined();
    });

    it('reports a 404 as nothing to delete', async () => {
      stubBackend({ asks: [A], forget: [{ status: 404 }] });
      const container = await renderShell();
      await submit(container, 'q');
      await click(button(container, 'FORGET'));
      expect(container.querySelector('[data-testid="shell-reference"]')?.textContent).toContain(
        ui.forgetNotFound,
      );
    });

    it('sends one request when forget is clicked twice while pending', async () => {
      let release: (response: Response) => void = () => undefined;
      const fetchMock = vi.fn(async (url: string) => {
        if (url === FORGET_URL) return new Promise<Response>((resolve) => (release = resolve));
        return askReply(A);
      });
      vi.stubGlobal('fetch', fetchMock);
      const container = await renderShell();
      await submit(container, 'q');
      await click(button(container, 'FORGET'));
      await click(button(container, ui.forgetting));
      const forgetCalls = fetchMock.mock.calls.filter(([url]) => url === FORGET_URL);
      expect(forgetCalls).toHaveLength(1);
      await act(async () => release(Response.json({ ok: true })));
    });

    it('still shows the trailer for a failed ask, but does not list it as a logged request', async () => {
      const fetchMock = vi.fn(async () => askReply(A, 503));
      vi.stubGlobal('fetch', fetchMock);
      const container = await renderShell();
      await submit(container, 'q');
      expect(container.querySelector('[data-testid="shell-reference"]')?.textContent).toContain(A);
      await submit(container, 'privacy');
      expect(feedLines(container).at(-1)).toBe(ui.privacyEmpty);
    });
  });

  describe('privacy command', () => {
    it('is listed in help and offered as a chip', async () => {
      const help = SHELL_RESPONSES.find((entry) => entry.commands.includes('help'));
      expect(help?.text).toContain('privacy');
      expect(shellUi[SITE_LOCALE.en].commands).toContain('privacy');
      expect(shellUi[SITE_LOCALE.pt].commands).toContain('privacy');
      stubBackend({});
      const container = await renderShell();
      expect(button(container, 'privacy')).toBeDefined();
    });

    it('says so when the session has logged nothing', async () => {
      stubBackend({});
      const container = await renderShell();
      await submit(container, 'privacy');
      expect(feedLines(container).at(-1)).toBe(ui.privacyEmpty);
    });

    it('lists this session request ids in order, numbered, after asks', async () => {
      stubBackend({ asks: [A, B] });
      const container = await renderShell();
      await submit(container, 'first');
      await submit(container, 'second');
      await submit(container, 'privacy');
      const lines = feedLines(container);
      expect(lines.some((line) => line.includes('2'))).toBe(true);
      expect(lines.at(-2)).toBe(`1. ${A}`);
      expect(lines.at(-1)).toBe(`2. ${B}`);
    });

    it('lists ids kept earlier in this tab from sessionStorage', async () => {
      window.sessionStorage.setItem('request-refs', JSON.stringify([C]));
      stubBackend({});
      const container = await renderShell();
      await submit(container, 'privacy');
      expect(feedLines(container).at(-1)).toBe(`1. ${C}`);
    });

    it('forgets by list number and prints one result line', async () => {
      const { forgetBodies } = stubBackend({ asks: [A, B] });
      const container = await renderShell();
      await submit(container, 'first');
      await submit(container, 'second');
      await submit(container, 'privacy forget 2');
      expect(forgetBodies).toEqual([JSON.stringify({ requestId: B })]);
      expect(feedLines(container).at(-1)).toBe(`${B} ${ui.forgetDeleted}`);
    });

    it('forgets by full id even when it is not in this session list', async () => {
      const { forgetBodies } = stubBackend({});
      const container = await renderShell();
      await submit(container, `privacy forget ${C}`);
      expect(forgetBodies).toEqual([JSON.stringify({ requestId: C })]);
      expect(feedLines(container).at(-1)).toBe(`${C} ${ui.forgetDeleted}`);
    });

    it('forgets every id one at a time with one result line each, then lists nothing', async () => {
      const { forgetBodies } = stubBackend({
        asks: [A, B],
        forget: [{ status: 200 }, { status: 500 }],
      });
      const container = await renderShell();
      await submit(container, 'first');
      await submit(container, 'second');
      await submit(container, 'privacy forget --all');
      expect(forgetBodies).toEqual([
        JSON.stringify({ requestId: A }),
        JSON.stringify({ requestId: B }),
      ]);
      const lines = feedLines(container);
      expect(lines.at(-2)).toBe(`${A} ${ui.forgetDeleted}`);
      expect(lines.at(-1)).toBe(`${B} ${ui.forgetFailed}`);
      await submit(container, 'privacy');
      expect(feedLines(container).at(-1)).toBe(`1. ${B}`);
    });

    it('stops at the first 429, prints the wait and the count it did not try', async () => {
      const { forgetBodies } = stubBackend({
        asks: [A, B, C],
        forget: [{ status: 200 }, { status: 429, headers: { 'Retry-After': '90' } }],
      });
      const container = await renderShell();
      await submit(container, '1');
      await submit(container, '2');
      await submit(container, '3');
      await submit(container, 'privacy forget --all');
      expect(forgetBodies).toHaveLength(2);
      const lines = feedLines(container);
      expect(lines.at(-3)).toBe(`${A} ${ui.forgetDeleted}`);
      expect(lines.at(-2)).toContain(`2 ${states.minutesUnit}`);
      expect(lines.at(-1)).toContain('1');
    });

    it('makes no request for an out-of-range number and says which one it could not find', async () => {
      const { fetchMock } = stubBackend({ asks: [A] });
      const container = await renderShell();
      await submit(container, 'first');
      fetchMock.mockClear();
      await submit(container, 'privacy forget 5');
      expect(fetchMock).not.toHaveBeenCalled();
      expect(feedLines(container).at(-1)).toContain('5');
    });

    it('prints usage for a malformed command and makes no request', async () => {
      const { fetchMock } = stubBackend({});
      const container = await renderShell();
      await submit(container, 'privacy forget');
      expect(fetchMock).not.toHaveBeenCalled();
      expect(feedLines(container).at(-1)).toBe(ui.privacyUsage);
    });

    it('answers in Portuguese on the pt shell', async () => {
      const pt = shellUi[SITE_LOCALE.pt];
      stubBackend({});
      const container = await renderShell(SITE_LOCALE.pt);
      await submit(container, 'privacy');
      expect(feedLines(container).at(-1)).toBe(pt.privacyEmpty);
      expect(pt.privacyEmpty).not.toBe(ui.privacyEmpty);
    });

    it('keeps working when sessionStorage throws', async () => {
      vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
      stubBackend({ asks: [A] });
      const container = await renderShell();
      await submit(container, 'q');
      await submit(container, 'privacy');
      expect(feedLines(container).at(-1)).toBe(`1. ${A}`);
    });
  });
});
