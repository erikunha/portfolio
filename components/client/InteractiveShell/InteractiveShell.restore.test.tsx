import { act, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushMicrotasks, type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { shellChrome } from '@/content/terminal-chrome';

vi.mock('@/lib/use-breakpoint.client', () => ({ useBreakpoint: () => ({ isMobile: false }) }));
vi.mock('@/lib/motion', () => ({ readMotion: () => false }));

const QUESTION = 'what does erik build';

function shellInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[aria-label="shell command"]');
  expect(input).not.toBeNull();
  return input as HTMLInputElement;
}

async function typeInto(container: HTMLElement, value: string): Promise<void> {
  const input = shellInput(container);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function submit(container: HTMLElement): Promise<void> {
  await act(async () => {
    container
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

describe('the shell puts a failed question back in the prompt', () => {
  let mounted: MountedClient;
  let failRequest: () => void = () => undefined;

  afterEach(() => {
    mounted?.unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function askAndHoldRequest(): Promise<HTMLElement> {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((_resolve, reject) => {
            failRequest = () => reject(new TypeError('Failed to fetch'));
          }),
      ),
    );
    const { InteractiveShell } = await import('./InteractiveShell');
    mounted = await mountClient(
      createElement(InteractiveShell, {
        locale: SITE_LOCALE.en,
        ui: shellUi[SITE_LOCALE.en],
        chrome: shellChrome[SITE_LOCALE.en],
      }),
    );
    await typeInto(mounted.container, QUESTION);
    await submit(mounted.container);
    return mounted.container;
  }

  async function failTheRequest(): Promise<void> {
    await act(async () => {
      failRequest();
    });
    await flushMicrotasks();
  }

  it('restores the question when the prompt was left alone', async () => {
    const container = await askAndHoldRequest();
    expect(shellInput(container).value).toBe('');

    await failTheRequest();

    expect(shellInput(container).value).toBe(QUESTION);
  });

  it('keeps what the visitor typed while the request was failing', async () => {
    const container = await askAndHoldRequest();
    await typeInto(container, 'zzz test');

    await failTheRequest();

    expect(shellInput(container).value).toBe('zzz test');
  });

  it('does not refill a prompt the visitor typed into and emptied again', async () => {
    const container = await askAndHoldRequest();
    await typeInto(container, 'x');
    await typeInto(container, '');

    await failTheRequest();

    expect(
      shellInput(container).value,
      'an emptied prompt is a choice: refilling it a moment later makes the next command append to the old question',
    ).toBe('');
  });

  it('restores again for the next failed question after an earlier edit', async () => {
    const container = await askAndHoldRequest();
    await typeInto(container, 'x');
    await typeInto(container, '');
    await failTheRequest();

    await typeInto(container, 'second question');
    await submit(container);
    await failTheRequest();

    expect(shellInput(container).value).toBe('second question');
  });
});
