import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { ShellCommand, shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { shellChrome } from '@/content/terminal-chrome';
import { InteractiveShell } from './InteractiveShell';

vi.mock('@/lib/use-breakpoint.client', () => ({ useBreakpoint: () => ({ isMobile: true }) }));
vi.mock('@/lib/motion', () => ({ readMotion: () => false }));

const ui = shellUi[SITE_LOCALE.en];
const LIVE_REGION = '[data-shell-live]';
const VIEWPORT_HEIGHT = 640;
const PARTLY_UNDER_THE_BARS = { top: -18, bottom: 360 };

let mounted: MountedClient | undefined;

beforeEach(() => {
  vi.stubGlobal('innerHeight', VIEWPORT_HEIGHT);
});

afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
  vi.unstubAllGlobals();
});

async function mountShell() {
  mounted = await mountClient(
    createElement(InteractiveShell, {
      locale: SITE_LOCALE.en,
      ui,
      chrome: shellChrome[SITE_LOCALE.en],
    }),
  );
  return mounted.container;
}

async function run(container: HTMLElement, command: string) {
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
}

describe('the shell on a narrow screen', () => {
  it('rests on the short placeholder, one that fits a 320px input without a cut word', async () => {
    const container = await mountShell();
    const placeholder = container.querySelector('[data-testid="shell-placeholder"]');
    expect(placeholder?.textContent).toBe(ui.mobilePlaceholder);
  });

  it('brings itself clear of the sticky header when a command prints output', async () => {
    const container = await mountShell();
    const live = container.querySelector<HTMLElement>(LIVE_REGION);
    if (!live) throw new Error('the shell has no live region to reveal');
    const scroll = vi.fn();
    live.scrollIntoView = scroll;
    live.getBoundingClientRect = () => ({ ...PARTLY_UNDER_THE_BARS }) as DOMRect;
    expect(scroll, 'opening the page must not move it').not.toHaveBeenCalled();

    await run(container, ShellCommand.Help);

    expect(scroll).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  });

  it('keeps the feed and the input in one revealed region', async () => {
    const container = await mountShell();
    const live = container.querySelector(LIVE_REGION);
    expect(live?.querySelector('[role="log"]')).not.toBeNull();
    expect(live?.querySelector('[data-testid="shell-form"]')).not.toBeNull();
  });
});
