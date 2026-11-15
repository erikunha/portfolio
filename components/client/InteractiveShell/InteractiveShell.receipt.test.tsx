import { within } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, type MountedClient } from '@/__tests__/helpers/render';
import { askQuestion, renderShell } from '@/__tests__/helpers/shell';
import { fillShellState, shellStates, shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';

vi.mock('@/lib/use-breakpoint.client', () => ({ useBreakpoint: () => ({ isMobile: false }) }));
vi.mock('@/lib/motion', () => ({ readMotion: () => false }));

const A = '7f3a9c2e-41b0-4d8e-9a77-3c51d0b2e8aa';
const B = '0b9d11e4-7c2a-4f6e-8e0d-2a6b9f3c1d55';
const C = '3c1f0a58-9d2e-4b7a-8c61-5e7d2f9b4a10';
const FORGET_URL = '/api/log/forget';
const ASK_URL = '/api/ask';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ui = shellUi[SITE_LOCALE.en];
const states = shellStates[SITE_LOCALE.en];

type AskReply = { id: string; status?: number };

function stubBackend(asks: AskReply[], forgets: number[] = []) {
  const askBodies: Record<string, unknown>[] = [];
  const forgetBodies: Record<string, unknown>[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      if (url === FORGET_URL) {
        forgetBodies.push(body);
        return Response.json({ ok: true }, { status: forgets.shift() ?? 200 });
      }
      if (url !== ASK_URL) throw new Error(`unexpected ${url}`);
      askBodies.push(body);
      const reply = asks.shift() ?? { id: C };
      const status = reply.status ?? 200;
      return new Response(status === 200 ? 'An answer.' : JSON.stringify({ error: 'nope' }), {
        status,
        headers: { 'X-Request-Id': reply.id },
      });
    }),
  );
  return { askBodies, forgetBodies };
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
  await flushMicrotasks();
}

const receipts = (container: HTMLElement) =>
  container.querySelectorAll('[data-testid="shell-receipt"]');
const feedText = (container: HTMLElement) =>
  container.querySelector('[role="log"]')?.textContent ?? '';

describe('one privacy receipt per conversation', () => {
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

  it('sends one conversation id with every question of the tab', async () => {
    const { askBodies } = stubBackend([{ id: A }, { id: B }]);
    mounted = await renderShell();
    const container = mounted.container;
    await askQuestion(container, 'first question', 2);
    await askQuestion(container, 'second question', 2);
    const [first, second] = askBodies;
    expect(first?.conversationId).toMatch(UUID);
    expect(second?.conversationId).toBe(first?.conversationId);
  });

  it('renders the receipt only after the latest answer, counting the questions, with no per-answer trailer', async () => {
    stubBackend([{ id: A }, { id: B }]);
    mounted = await renderShell();
    const container = mounted.container;
    await askQuestion(container, 'first question', 2);
    await askQuestion(container, 'second question', 2);
    expect(receipts(container)).toHaveLength(1);
    const receipt = receipts(container)[0];
    expect(receipt?.querySelector('code')?.textContent).toBe(B);
    expect(receipt?.textContent).toContain(fillShellState(ui.receiptQuestionsMany, { count: '2' }));
    const lines = [...container.querySelectorAll('[role="log"] .shell-line')];
    expect(lines.at(-1)?.contains(receipt ?? null)).toBe(true);
    expect(feedText(container)).not.toContain('-- req=');
    expect(feedText(container)).not.toContain(A);
  });

  it('keeps the receipt after the latest answer when a later request is refused', async () => {
    stubBackend([{ id: A }, { id: B, status: 429 }]);
    mounted = await renderShell();
    const container = mounted.container;
    await askQuestion(container, 'first question', 2);
    await askQuestion(container, 'second question', 2);
    expect(receipts(container)).toHaveLength(1);
    expect(receipts(container)[0]?.querySelector('code')?.textContent).toBe(A);
    expect(receipts(container)[0]?.textContent).toContain(ui.receiptQuestionsOne);
  });

  it('forget conversation clears the receipt, reports the count, refocuses the input and starts a new conversation', async () => {
    const { askBodies, forgetBodies } = stubBackend([{ id: A }, { id: B }, { id: C }]);
    mounted = await renderShell();
    const container = mounted.container;
    await askQuestion(container, 'first question', 2);
    await askQuestion(container, 'second question', 2);
    await click(named(container, ui.forget));
    await click(named(container, ui.forgetConfirm));

    expect(forgetBodies).toEqual([{ requestId: B }]);
    expect(receipts(container)).toHaveLength(0);
    expect(feedText(container)).toContain(ui.conversationForgotten);
    expect(feedText(container)).toContain(
      fillShellState(ui.conversationForgottenMany, { count: '2' }),
    );
    expect(document.activeElement).toBe(container.querySelector('input[name="command"]'));
    const forgotten = [...container.querySelectorAll('[role="log"] .shell-line')].find((line) =>
      line.textContent?.includes(ui.conversationForgotten),
    );
    expect(forgotten?.closest('[role="log"][aria-live="polite"]')).not.toBeNull();
    expect(forgotten?.closest('[aria-live="off"], [aria-hidden="true"]')).toBeNull();
    expect(container.querySelector('p[role="status"]')?.textContent).not.toContain(
      ui.conversationForgotten,
    );

    await askQuestion(container, 'third question', 2);
    expect(askBodies[2]?.conversationId).toMatch(UUID);
    expect(askBodies[2]?.conversationId).not.toBe(askBodies[0]?.conversationId);
    expect(receipts(container)[0]?.textContent).toContain(ui.receiptQuestionsOne);
  });

  it('privacy forget with no target forgets this conversation', async () => {
    const { forgetBodies } = stubBackend([{ id: A }]);
    mounted = await renderShell();
    const container = mounted.container;
    await askQuestion(container, 'a question', 2);
    await askQuestion(container, 'privacy forget', 2);
    expect(forgetBodies).toEqual([{ requestId: A }]);
    expect(receipts(container)).toHaveLength(0);
    expect(feedText(container)).toContain(ui.conversationForgotten);
  });

  it('privacy forget with no logged question says so and sends nothing', async () => {
    const { forgetBodies } = stubBackend([]);
    mounted = await renderShell();
    const container = mounted.container;
    await askQuestion(container, 'privacy forget', 2);
    expect(forgetBodies).toEqual([]);
    expect(feedText(container)).toContain(ui.privacyNoConversation);
  });

  it('privacy forget <n> on an id of this conversation ends the conversation too', async () => {
    stubBackend([{ id: A }, { id: B }]);
    mounted = await renderShell();
    const container = mounted.container;
    await askQuestion(container, 'first question', 2);
    await askQuestion(container, 'second question', 2);
    await askQuestion(container, 'privacy forget 1', 2);
    expect(feedText(container)).toContain(`${A} ${ui.forgetDeleted}`);
    expect(receipts(container)).toHaveLength(0);
    await askQuestion(container, 'privacy', 2);
    expect(feedText(container)).toContain(ui.privacyEmpty);
  });

  it('privacy forget --all forgets the conversation once through its latest id', async () => {
    const { forgetBodies } = stubBackend([{ id: A }, { id: B }]);
    mounted = await renderShell();
    const container = mounted.container;
    await askQuestion(container, 'first question', 2);
    await askQuestion(container, 'second question', 2);
    await askQuestion(container, 'privacy forget --all', 2);
    expect(forgetBodies).toEqual([{ requestId: B }]);
    expect(feedText(container)).toContain(`${B} ${ui.forgetDeleted}`);
    expect(receipts(container)).toHaveLength(0);
  });

  it('a failed privacy forget keeps the receipt and names the outage', async () => {
    stubBackend([{ id: A }], [503]);
    mounted = await renderShell();
    const container = mounted.container;
    await askQuestion(container, 'a question', 2);
    await askQuestion(container, 'privacy forget', 2);
    expect(receipts(container)).toHaveLength(1);
    expect(feedText(container)).toContain(ui.forgetUnavailable);
    expect(states.minutesUnit).toBeTruthy();
  });
});
