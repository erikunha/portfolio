import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hydrateClient, type MountedClient } from '@/__tests__/helpers/render';
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
});
