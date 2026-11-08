import { act, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE } from '@/content/site-locale';
import { ShellToolbar } from './ShellToolbar.client';

const ui = shellUi[SITE_LOCALE.en];

describe('ShellToolbar', () => {
  let mounted: MountedClient | undefined;

  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
  });

  async function renderToolbar(
    busy = false,
    onActivate: (command: string) => void = () => undefined,
  ) {
    mounted = await mountClient(createElement(ShellToolbar, { ui, busy, onActivate }));
    const toolbar = mounted.container.querySelector('[role="toolbar"]') as HTMLElement;
    return { toolbar, buttons: Array.from(toolbar.querySelectorAll('button')) };
  }

  async function press(target: HTMLElement, key: string, modifiers: KeyboardEventInit = {}) {
    await act(async () => {
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers }),
      );
    });
  }

  it('exposes the toolbar label and one button per command with a single tab stop', async () => {
    const { toolbar, buttons } = await renderToolbar();
    expect(toolbar.getAttribute('aria-label')).toBe(ui.toolbarLabel);
    expect(buttons.map((button) => button.dataset.cmd)).toEqual([...ui.commands]);
    expect(buttons.filter((button) => button.tabIndex === 0)).toEqual([buttons[0]]);
    expect(toolbar.textContent).toContain(ui.commandHint);
  });

  it('moves focus with the arrows, wrapping at both ends, and Home and End jump to the ends', async () => {
    const { buttons } = await renderToolbar();
    const last = buttons.at(-1) as HTMLButtonElement;
    (buttons[0] as HTMLButtonElement).focus();
    await press(buttons[0] as HTMLElement, 'ArrowLeft');
    expect(document.activeElement).toBe(last);
    await press(last, 'ArrowRight');
    expect(document.activeElement).toBe(buttons[0]);
    await press(buttons[0] as HTMLElement, 'ArrowRight');
    expect(document.activeElement).toBe(buttons[1]);
    await press(buttons[1] as HTMLElement, 'End');
    expect(document.activeElement).toBe(last);
    await press(last, 'Home');
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('keeps the tab stop on the focused button', async () => {
    const { buttons } = await renderToolbar();
    (buttons[0] as HTMLButtonElement).focus();
    await press(buttons[0] as HTMLElement, 'End');
    expect(buttons.filter((button) => button.tabIndex === 0)).toEqual([buttons.at(-1)]);
  });

  it('ignores arrows that carry a modifier and keys that are not navigation', async () => {
    const { buttons } = await renderToolbar();
    (buttons[0] as HTMLButtonElement).focus();
    await press(buttons[0] as HTMLElement, 'ArrowRight', { shiftKey: true });
    await press(buttons[0] as HTMLElement, 'ArrowRight', { ctrlKey: true });
    await press(buttons[0] as HTMLElement, 'ArrowRight', { altKey: true });
    await press(buttons[0] as HTMLElement, 'ArrowRight', { metaKey: true });
    await press(buttons[0] as HTMLElement, 'ArrowUp');
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('mirrors busy as aria-disabled on every button without disabling focus', async () => {
    const idle = await renderToolbar(false);
    expect(idle.buttons.every((button) => button.getAttribute('aria-disabled') === 'false')).toBe(
      true,
    );
    mounted?.unmount();
    const busy = await renderToolbar(true);
    expect(busy.buttons.every((button) => button.getAttribute('aria-disabled') === 'true')).toBe(
      true,
    );
    expect(busy.buttons.some((button) => button.disabled)).toBe(false);
  });

  it('reports the activated command', async () => {
    const onActivate = vi.fn();
    const { buttons } = await renderToolbar(false, onActivate);
    await act(async () => {
      (buttons[2] as HTMLButtonElement).click();
    });
    expect(onActivate).toHaveBeenCalledWith(ui.commands[2]);
  });
});
