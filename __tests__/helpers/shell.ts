import { act, createElement } from 'react';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { shellChrome } from '@/content/terminal-chrome';
import { fire, flushMicrotasks, type MountedClient, mountClient } from './render';

const COMMAND_INPUT = 'input[name="command"]';

export async function renderShell(locale: SiteLocale = SITE_LOCALE.en): Promise<MountedClient> {
  const { InteractiveShell } = await import(
    '@/components/client/InteractiveShell/InteractiveShell'
  );
  return mountClient(
    createElement(InteractiveShell, {
      locale,
      ui: shellUi[locale],
      chrome: shellChrome[locale],
    }),
  );
}

export async function typeCommand(container: HTMLElement, text: string): Promise<void> {
  const input = container.querySelector<HTMLInputElement>(COMMAND_INPUT);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    if (input && setter) setter.call(input, text);
    fire(input, new Event('input', { bubbles: true }));
  });
}

export async function submitCommand(container: HTMLElement): Promise<void> {
  await act(async () => {
    fire(container.querySelector('form'), new Event('submit', { bubbles: true, cancelable: true }));
  });
}

export async function askQuestion(
  container: HTMLElement,
  question: string,
  flushes = 1,
): Promise<void> {
  await typeCommand(container, question);
  await submitCommand(container);
  for (let flushed = 0; flushed < flushes; flushed += 1) await flushMicrotasks();
}
