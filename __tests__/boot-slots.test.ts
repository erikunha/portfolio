import { describe, expect, it, vi } from 'vitest';
import { heroClientContent } from '@/content/hero-client';
import { SITE_LOCALE } from '@/content/site-locale';
import {
  BOOT_SLOT_ATTR,
  type BootClasses,
  bootSlotSpecs,
  buildBootSlots,
  buildLine,
  desktopBootLines,
  placeBootLine,
} from '@/lib/boot-animation';

const cls: BootClasses = {
  bootLine: 'line',
  bootOk: 'ok',
  bootEnc: 'enc',
  bootWelcome: 'welcome',
  bootPrompt: 'prompt',
  bootCmd: 'cmd',
  bootMatrixPrefix: 'prefix',
  bootMatrixOut: 'out',
  bootCursor: 'cursor',
  shake: 'shake',
  shake2: 'shake2',
};
const copy = heroClientContent[SITE_LOCALE.en];
const SLOT_CLASS = 'slot';
const COMMAND_AND_DIALOG_LINES = 3;
const RESERVED_HEIGHT_PX = 48;

function host(): HTMLElement {
  const element = document.createElement('div');
  element.replaceChildren(...buildBootSlots(copy, cls, SLOT_CLASS));
  return element;
}

describe('boot slots', () => {
  it('reserves one slot per final line: the boot log, the command, a blank and the dialog', () => {
    expect(bootSlotSpecs(copy)).toHaveLength(
      desktopBootLines(copy).length + COMMAND_AND_DIALOG_LINES,
    );
    expect(host().querySelectorAll(`[${BOOT_SLOT_ATTR}]`)).toHaveLength(bootSlotSpecs(copy).length);
  });

  it('replaces the first slot with each placed line, so the child count never changes', () => {
    const element = host();
    const total = element.childElementCount;
    const first = buildLine(['first'], cls);
    const second = buildLine(['second'], cls);
    placeBootLine(element, first);
    placeBootLine(element, second);
    expect(element.childElementCount).toBe(total);
    expect(element.children[0]).toBe(first);
    expect(element.children[1]).toBe(second);
    expect(element.querySelectorAll(`[${BOOT_SLOT_ATTR}]`)).toHaveLength(total - 2);
  });

  it('keeps the height of the slot a placed line replaces, so a shorter line cannot move the rest', () => {
    const element = host();
    const slot = element.children[0] as HTMLElement;
    vi.spyOn(slot, 'getBoundingClientRect').mockReturnValue({
      height: RESERVED_HEIGHT_PX,
    } as DOMRect);
    const line = buildLine(['short'], cls);
    placeBootLine(element, line);
    expect(line.style.minHeight).toBe(`${RESERVED_HEIGHT_PX}px`);
  });

  it('appends when the host holds no slot', () => {
    const element = document.createElement('div');
    const line = buildLine(['plain'], cls);
    placeBootLine(element, line);
    expect(element.children[0]).toBe(line);
  });

  it('marks reserved slots without the live line test id', () => {
    for (const slot of host().children) {
      expect(slot.getAttribute('data-testid')).toBeNull();
      expect(slot.className).toBe(SLOT_CLASS);
    }
  });

  it.each(Object.values(SITE_LOCALE))(
    'reserves the longest desktop dialog phrase of %s, so its typed width cannot grow the slot',
    (locale) => {
      const localeCopy = heroClientContent[locale];
      const longest = localeCopy.bootDialogDesktop.reduce((a, b) => (b.length > a.length ? b : a));
      const dialogSlot = bootSlotSpecs(localeCopy).at(-1);
      expect(dialogSlot?.parts).toContain(longest);
      expect(bootSlotSpecs(localeCopy)).toHaveLength(
        desktopBootLines(localeCopy).length + COMMAND_AND_DIALOG_LINES,
      );
    },
  );
});
