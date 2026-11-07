import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, hydrateClient, type MountedClient } from '@/__tests__/helpers/render';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { shellChrome } from '@/content/terminal-chrome';
import { InteractiveShell } from './InteractiveShell';

vi.mock('@/lib/use-breakpoint.client', () => ({ useBreakpoint: () => ({ isMobile: false }) }));
vi.mock('@/lib/motion', () => ({ readMotion: () => false }));

const TYPED_COMMAND = 'help me';

describe('InteractiveShell hydrating over a command the visitor already typed', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
  });

  it('adopts the typed command into its input state and hides the placeholder', async () => {
    mounted = await hydrateClient(
      createElement(InteractiveShell, {
        locale: SITE_LOCALE.en,
        ui: shellUi[SITE_LOCALE.en],
        chrome: shellChrome[SITE_LOCALE.en],
      }),
      (container) => {
        (container.querySelector('input[name="command"]') as HTMLInputElement).value =
          TYPED_COMMAND;
      },
    );

    const input = mounted.container.querySelector('input[name="command"]') as HTMLInputElement;
    expect(input.value).toBe(TYPED_COMMAND);
    expect(
      mounted.container.querySelector('[data-testid="shell-placeholder"]'),
      'the placeholder still covers a command that was typed before hydration',
    ).toBeNull();
  });

  it('runs an Enter pressed before hydration once, from the submit React queued', async () => {
    const queue: unknown[] = [];
    Object.defineProperty(document, '$$reactFormReplay', { value: queue, configurable: true });
    try {
      mounted = await hydrateClient(
        createElement(InteractiveShell, {
          locale: SITE_LOCALE.en,
          ui: shellUi[SITE_LOCALE.en],
          chrome: shellChrome[SITE_LOCALE.en],
        }),
        (container) => {
          const form = container.querySelector('form') as HTMLFormElement;
          const input = form.querySelector('input[name="command"]') as HTMLInputElement;
          input.value = TYPED_COMMAND;
          queue.push(form, undefined, new FormData(form));
        },
      );
      await flushMicrotasks();

      const prompts = mounted.container.querySelectorAll('[data-kind="prompt"]');
      expect(
        prompts,
        'a submit queued before hydration replays exactly once instead of navigating or being dropped',
      ).toHaveLength(1);
      expect(prompts[0]?.textContent).toContain(TYPED_COMMAND);
    } finally {
      Reflect.deleteProperty(document, '$$reactFormReplay');
    }
  });
});
