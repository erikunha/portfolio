import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { ShellLineKind, shellStates, shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { LineText, RateLimitCountdown, ShellLine, ThinkingLine } from './ShellLines.client';
import type { Line } from './useAskStream';

const ui = shellUi[SITE_LOCALE.en];
const states = shellStates[SITE_LOCALE.en];
const MS_PER_SECOND = 1000;

describe('shell line parts', () => {
  let mounted: MountedClient | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
    vi.useRealTimers();
  });

  async function advance(ms: number) {
    await act(async () => {
      vi.advanceTimersByTime(ms);
    });
  }

  it('ThinkingLine counts elapsed tenths of a second into its template', async () => {
    mounted = await mountClient(
      createElement('p', null, createElement(ThinkingLine, { template: states.thinkingElapsed })),
    );
    const text = () => mounted?.container.textContent;
    expect(text()).toBe('[ thinking 0.0s ]');
    await advance(MS_PER_SECOND * 2.5);
    expect(text()).toBe('[ thinking 2.5s ]');
  });

  it('LineText links the contact address inside a sentence and leaves other text plain', async () => {
    mounted = await mountClient(
      createElement('p', null, createElement(LineText, { text: `write to ${ui.email} today`, ui })),
    );
    const link = mounted.container.querySelector('a');
    expect(link?.getAttribute('href')).toBe(ui.emailHref);
    expect(link?.textContent).toBe(ui.email);
    expect(mounted.container.textContent).toBe(`write to ${ui.email} today`);
    mounted.unmount();
    mounted = await mountClient(
      createElement('p', null, createElement(LineText, { text: 'plain', ui })),
    );
    expect(mounted.container.querySelector('a')).toBeNull();
    expect(mounted.container.textContent).toBe('plain');
  });

  it('RateLimitCountdown counts down, then announces readiness and fills the bar', async () => {
    const seconds = 3;
    mounted = await mountClient(
      createElement(RateLimitCountdown, { seconds, announcement: 'wait please', states }),
    );
    const visible = () => mounted?.container.querySelector('[aria-hidden="true"]');
    expect(mounted.container.querySelector('.sr-only')?.textContent).toBe('wait please');
    expect(visible()?.textContent).toContain('! slow down: 3 s until the next question');
    expect(visible()?.querySelector('.shell-ratelimit-bar')?.textContent).toBe(
      `[${'.'.repeat(20)}]`,
    );
    await advance(MS_PER_SECOND);
    expect(visible()?.textContent).toContain('2 s until');
    await advance(MS_PER_SECOND * 2);
    expect(visible()?.querySelector('.shell-ratelimit-headline')?.textContent).toBe(
      states.rateLimitReady,
    );
    expect(visible()?.querySelector('.shell-ratelimit-bar')?.textContent).toBe(
      `[${'#'.repeat(20)}]`,
    );
    expect(visible()?.textContent).toContain(states.localCommands);
  });

  it('RateLimitCountdown shows minutes for waits of a minute or more', async () => {
    mounted = await mountClient(
      createElement(RateLimitCountdown, { seconds: 90, announcement: 'wait', states }),
    );
    expect(mounted.container.querySelector('.shell-ratelimit-headline')?.textContent).toContain(
      `2 ${states.minutesUnit}`,
    );
  });
});

describe('ShellLine', () => {
  let mounted: MountedClient | undefined;

  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
  });

  async function renderLine(
    line: Line,
    extra: { isMobile?: boolean; onRetry?: (command: string) => void } = {},
  ) {
    mounted = await mountClient(
      createElement(ShellLine, {
        line,
        ui,
        states,
        isMobile: extra.isMobile ?? false,
        announce: () => undefined,
        onRetry: extra.onRetry ?? (() => undefined),
        busy: false,
        onConversationForgotten: () => undefined,
      }),
    );
    return mounted.container;
  }

  it('renders a loading line as an aria-hidden thinking indicator, leaving the stop hint to the stop pill', async () => {
    const container = await renderLine({ id: 1, kind: ShellLineKind.Loading, text: '' });
    const line = container.querySelector('[data-testid="shell-line-loading"]');
    expect(line?.getAttribute('aria-hidden')).toBe('true');
    expect(line?.textContent).toContain('[ thinking');
    expect(line?.querySelector('kbd')).toBeNull();
  });

  it('renders a reference line as the conversation receipt', async () => {
    const container = await renderLine({ id: 2, kind: ShellLineKind.Reference, text: 'req-1' });
    expect(container.querySelector('[data-testid="shell-receipt"] code')?.textContent).toBe(
      'req-1',
    );
  });

  it('renders a rate-limit line with a countdown only when it carries a wait', async () => {
    const withWait = await renderLine({
      id: 3,
      kind: ShellLineKind.RateLimit,
      text: 'wait',
      retryAfter: 5,
    });
    expect(withWait.querySelector('.shell-ratelimit-headline')).not.toBeNull();
    mounted?.unmount();
    const withoutWait = await renderLine({
      id: 4,
      kind: ShellLineKind.RateLimit,
      text: 'plain limit',
    });
    expect(withoutWait.querySelector('.shell-ratelimit-headline')).toBeNull();
    expect(withoutWait.textContent).toContain('plain limit');
  });

  it('renders a hint line with the offline command and the contact link', async () => {
    const container = await renderLine({ id: 5, kind: ShellLineKind.Hint, text: '' });
    expect(container.querySelector('code')?.textContent).toBe(states.tryCommand);
    expect(container.querySelector('a')?.getAttribute('href')).toBe(ui.emailHref);
  });

  it('renders an AI answer with its label and a prefixed failure with a retry that reports its command', async () => {
    const onRetry = vi.fn();
    const answer = await renderLine({ id: 6, kind: ShellLineKind.Output, text: 'Hello', ai: true });
    expect(answer.querySelector('.shell-ai-label')?.textContent).toBe(`${ui.aiLabel}: `);
    mounted?.unmount();
    const failure = await renderLine(
      { id: 7, kind: ShellLineKind.Error, text: 'boom', prefix: 'ask:', retry: 'who is erik' },
      { onRetry },
    );
    expect(failure.querySelector('.shell-stderr-command')?.textContent).toBe('ask:');
    const retry = failure.querySelector<HTMLButtonElement>(
      'button[aria-label="Retry the last question"]',
    );
    await act(async () => {
      retry?.click();
    });
    expect(onRetry).toHaveBeenCalledWith('who is erik');
  });

  it('swaps the welcome line for its short form on a narrow viewport only', async () => {
    const welcome: Line = { id: 8, kind: ShellLineKind.Info, text: ui.welcome, welcome: true };
    expect((await renderLine(welcome, { isMobile: true })).textContent).toBe(ui.mobileWelcome);
    mounted?.unmount();
    expect((await renderLine(welcome, { isMobile: false })).textContent).toBe(ui.welcome);
  });

  it('tags each line with its kind class and data attribute', async () => {
    const container = await renderLine({ id: 9, kind: ShellLineKind.Info, text: 'info' });
    const line = container.querySelector('.shell-line');
    expect(line?.classList.contains('shell-line-info')).toBe(true);
    expect(line?.getAttribute('data-kind')).toBe(ShellLineKind.Info);
  });
});
