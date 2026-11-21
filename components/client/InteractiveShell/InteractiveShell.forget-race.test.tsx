import { within } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, type MountedClient } from '@/__tests__/helpers/render';
import { askQuestion, renderShell } from '@/__tests__/helpers/shell';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';

vi.mock('@/lib/use-breakpoint.client', () => ({ useBreakpoint: () => ({ isMobile: false }) }));
vi.mock('@/lib/motion', () => ({ readMotion: () => false }));

const A = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
const B = '0b9d11e4-7c2a-4f6e-8e0d-2a6b9f3c1d55';
const FORGET_URL = '/api/log/forget';
const ASK_URL = '/api/ask';
const ui = shellUi[SITE_LOCALE.en];

function stubBackend(askIds: string[]) {
  const askBodies: Record<string, unknown>[] = [];
  const forgetReleases: (() => void)[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      if (url === FORGET_URL) {
        await new Promise<void>((release) => forgetReleases.push(release));
        return Response.json({ ok: true });
      }
      if (url !== ASK_URL) throw new Error(`unexpected ${url}`);
      askBodies.push(body);
      return new Response('An answer.', {
        headers: { 'X-Request-Id': askIds.shift() ?? B },
      });
    }),
  );
  return {
    askBodies,
    releaseForget: async () => {
      await act(async () => forgetReleases.shift()?.());
      await flushMicrotasks();
      await flushMicrotasks();
    },
  };
}

function named(container: HTMLElement, name: string): HTMLButtonElement {
  const receipt = container.querySelector<HTMLElement>('[data-testid="shell-receipt"]');
  if (!receipt) throw new Error('no receipt');
  return within(receipt).getByRole<HTMLButtonElement>('button', { name });
}

async function click(button: HTMLElement) {
  await act(async () => {
    button.click();
  });
  await flushMicrotasks();
}

const receipts = (container: HTMLElement) =>
  container.querySelectorAll('[data-testid="shell-receipt"]');
const inputValue = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>('input[name="command"]')?.value;
const status = (container: HTMLElement) => container.querySelector('p[role="status"]')?.textContent;

describe('a question asked while a forget is pending', () => {
  let mounted: MountedClient | undefined;

  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('waits, keeps the draft, and the next question starts a new conversation with its own receipt and ref', async () => {
    const { askBodies, releaseForget } = stubBackend([A, B]);
    mounted = await renderShell();
    const container = mounted.container;
    await askQuestion(container, 'first question', 2);
    await click(named(container, ui.forget));
    await click(named(container, ui.forgetConfirm));

    await askQuestion(container, 'second question', 2);
    expect(askBodies).toHaveLength(1);
    expect(inputValue(container)).toBe('second question');
    expect(status(container)).toBe(ui.forgetting);

    await releaseForget();
    expect(receipts(container)).toHaveLength(0);

    await askQuestion(container, 'second question', 2);
    expect(askBodies).toHaveLength(2);
    expect(askBodies[1]?.conversationId).not.toBe(askBodies[0]?.conversationId);
    expect(receipts(container)).toHaveLength(1);
    expect(receipts(container)[0]?.querySelector('code')?.textContent).toBe(B);
    expect(receipts(container)[0]?.textContent).toContain(ui.receiptQuestionsOne);
    const conversation = await import('@/lib/ask/conversation.client');
    const refs = await import('@/lib/request-refs.client');
    expect(refs.listRefs()).toEqual([B]);
    expect(conversation.inConversation(B)).toBe(true);
  });

  it('applies to a forget started from the privacy command as well', async () => {
    const { askBodies, releaseForget } = stubBackend([A, B]);
    mounted = await renderShell();
    const container = mounted.container;
    await askQuestion(container, 'first question', 2);
    await askQuestion(container, 'privacy forget', 2);
    await askQuestion(container, 'second question', 2);
    expect(askBodies).toHaveLength(1);
    await releaseForget();
    await askQuestion(container, 'second question', 2);
    expect(askBodies).toHaveLength(2);
    expect(receipts(container)[0]?.textContent).toContain(ui.receiptQuestionsOne);
  });

  it('still runs local commands while the forget is pending', async () => {
    const { askBodies, releaseForget } = stubBackend([A]);
    mounted = await renderShell();
    const container = mounted.container;
    await askQuestion(container, 'first question', 2);
    await click(named(container, ui.forget));
    await click(named(container, ui.forgetConfirm));
    await askQuestion(container, 'help', 2);
    expect(container.querySelector('[role="log"]')?.textContent).toContain('help');
    expect(askBodies).toHaveLength(1);
    await releaseForget();
  });
});
