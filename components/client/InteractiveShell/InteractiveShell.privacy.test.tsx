import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fire, flushMicrotasks, type MountedClient, mountClient } from '@/__tests__/helpers/render';
import SHELL_RESPONSES from '@/content/shell-commands';
import { fillShellState, shellStates, shellUi } from '@/content/shell-ui';
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
    fire(input, new Event('input', { bubbles: true }));
  });
  await act(async () => {
    fire(form, new Event('submit', { bubbles: true, cancelable: true }));
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

  describe('request ids', () => {
    it.each([
      [SITE_LOCALE.en, 'no record kept under this id'],
      [SITE_LOCALE.pt, 'nenhum registro mantido com este id'],
    ] as const)(
      'confirms in %s without claiming a record existed, because the server answers a known and an unknown id alike',
      (locale, phrase) => {
        const copy = shellUi[locale];
        expect(copy.forgetDeleted).toContain(phrase);
        expect(copy.forgetDeleted).not.toMatch(/deleted|excluído/i);
        expect('forgetNotFound' in copy).toBe(false);
      },
    );

    it('lists the id of a failed ask that carries the header, because the server may have stored a row for it', async () => {
      const fetchMock = vi.fn(async () => askReply(A, 429));
      vi.stubGlobal('fetch', fetchMock);
      const container = await renderShell();
      await submit(container, 'q');
      expect(container.querySelector('[data-testid="shell-receipt"]')).toBeNull();
      await submit(container, 'privacy');
      expect(feedLines(container).at(-1)).toBe(`1. ${A}`);
    });

    it('lists nothing for a failed ask that carries no header', async () => {
      const fetchMock = vi.fn(async () => askReply(null, 503));
      vi.stubGlobal('fetch', fetchMock);
      const container = await renderShell();
      await submit(container, 'q');
      expect(container.querySelector('[data-testid="shell-receipt"]')).toBeNull();
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
      expect(feedLines(container)).toContain(`${B} ${ui.forgetDeleted}`);
      expect(feedLines(container)).toContain(ui.conversationForgotten);
    });

    it('forgets by full id even when it is not in this session list', async () => {
      const { forgetBodies } = stubBackend({});
      const container = await renderShell();
      await submit(container, `privacy forget ${C}`);
      expect(forgetBodies).toEqual([JSON.stringify({ requestId: C })]);
      expect(feedLines(container).at(-1)).toBe(`${C} ${ui.forgetDeleted}`);
    });

    it('forgets the conversation once and every other id one at a time, one result line each', async () => {
      window.sessionStorage.setItem('request-refs', JSON.stringify([C]));
      const { forgetBodies } = stubBackend({
        asks: [A, B],
        forget: [{ status: 200 }, { status: 500 }],
      });
      const container = await renderShell();
      await submit(container, 'first');
      await submit(container, 'second');
      await submit(container, 'privacy forget --all');
      expect(forgetBodies).toEqual([
        JSON.stringify({ requestId: B }),
        JSON.stringify({ requestId: C }),
      ]);
      const lines = feedLines(container);
      expect(lines).toContain(`${B} ${ui.forgetDeleted}`);
      expect(lines).toContain(`${C} ${ui.forgetFailed}`);
      await submit(container, 'privacy');
      expect(feedLines(container).at(-1)).toBe(`1. ${C}`);
    });

    it('stops at the first 429, prints the wait and the count it did not try', async () => {
      window.sessionStorage.setItem('request-refs', JSON.stringify([B, C]));
      const { forgetBodies } = stubBackend({
        asks: [A],
        forget: [{ status: 200 }, { status: 429, headers: { 'Retry-After': '90' } }],
      });
      const container = await renderShell();
      await submit(container, '1');
      await submit(container, 'privacy forget --all');
      expect(forgetBodies).toHaveLength(2);
      const text = feedLines(container).join('\n');
      expect(text).toContain(`${A} ${ui.forgetDeleted}`);
      expect(text).toContain(`2 ${states.minutesUnit}`);
      expect(text).toContain(fillShellState(ui.privacyNotAttempted, { count: '1' }));
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
      await submit(container, 'privacy forget abc');
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
