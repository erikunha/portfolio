import { act, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import SHELL_RESPONSES from '@/content/shell-commands';
import { ShellCommand, shellUi } from '@/content/shell-ui';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { shellChrome } from '@/content/terminal-chrome';

vi.mock('@/lib/use-breakpoint.client', () => ({
  useBreakpoint: () => ({ isMobile: false }),
}));

vi.mock('@/lib/motion', () => ({
  readMotion: () => false,
}));

let mounted: MountedClient | undefined;

afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
});

async function runLocalCommand(locale: SiteLocale, command: string): Promise<HTMLElement> {
  const { InteractiveShell } = await import('./InteractiveShell');
  mounted = await mountClient(
    createElement(InteractiveShell, {
      locale,
      ui: shellUi[locale],
      chrome: shellChrome[locale],
    }),
  );
  const input = mounted.container.querySelector<HTMLInputElement>('input[name="command"]');
  const form = mounted.container.querySelector<HTMLFormElement>('form');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    if (input && setter) setter.call(input, command);
    input?.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => {
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  return mounted.container;
}

describe('shell local responses are English text (WCAG 3.1.2)', () => {
  it.each(Object.values(SITE_LOCALE))(
    'marks the %s page local response with lang="en", the language it is written in',
    async (locale) => {
      const container = await runLocalCommand(locale, ShellCommand.Help);
      const help = SHELL_RESPONSES.find((entry) => entry.commands.includes(ShellCommand.Help));
      const lines = [...container.querySelectorAll<HTMLElement>('.shell-line-output')];
      const response = lines.find((line) =>
        line.textContent?.includes(help?.text.slice(0, 20) ?? ''),
      );
      expect(response, 'the help response is in the feed').toBeDefined();
      expect(
        response?.getAttribute('lang'),
        'a screen reader on a Portuguese page would read the English reply with the Portuguese voice',
      ).toBe(SITE_LOCALE.en);
    },
  );

  it('leaves the localized welcome and prompt lines to the page language', async () => {
    const container = await runLocalCommand(SITE_LOCALE.pt, ShellCommand.Help);
    const prompt = container.querySelector('.shell-line-prompt');
    const welcome = container.querySelector('.shell-line-info');
    expect(prompt?.hasAttribute('lang')).toBe(false);
    expect(welcome?.hasAttribute('lang')).toBe(false);
  });
});
