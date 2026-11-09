import { expect, type Page, test } from '@playwright/test';
import { installMockBackend } from './_helpers/mock-backend';
import { gotoSettled } from './_helpers/streamed';

const SIGNAL_RGB = 'rgb(0, 255, 65)';
const RING_WIDTH_PX = 2;
const RING_OFFSETS_PX = [2, -2];
const MAX_TABS = 140;
const MIN_TARGETS = 8;
const SETTLE_FRAMES = 2;
const ROUTES = ['/', '/links', '/design-system'];
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'phone', width: 390, height: 844 },
];
const OWN_INDICATOR = new Set(['shell-input']);

interface Focused {
  label: string;
  className: string;
  style: string;
  width: number;
  offset: number;
  color: string;
}

async function readFocused(page: Page): Promise<Focused | null> {
  return page.evaluate(() => {
    const node = document.activeElement;
    if (!node || node === document.body || node === document.documentElement) return null;
    const style = getComputedStyle(node);
    return {
      label: `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}`,
      className: typeof node.className === 'string' ? node.className : '',
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
      offset: Number.parseFloat(style.outlineOffset),
      color: style.outlineColor,
    };
  });
}

for (const viewport of VIEWPORTS) {
  for (const route of ROUTES) {
    test(`every control the keyboard reaches on ${route} shows the one site focus ring at ${viewport.name}`, async ({
      page,
    }) => {
      await installMockBackend(page, { log: 'accept', forget: 'happy' });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoSettled(page, route);
      await page.evaluate(
        (frames) =>
          new Promise<void>((resolve) => {
            let remaining = frames;
            const tick = () => (--remaining <= 0 ? resolve() : requestAnimationFrame(tick));
            requestAnimationFrame(tick);
          }),
        SETTLE_FRAMES,
      );

      const seen = new Set<string>();
      const offenders: string[] = [];
      for (let step = 0; step < MAX_TABS; step++) {
        await page.keyboard.press('Tab');
        const focused = await readFocused(page);
        if (!focused) break;
        const key = `${focused.label}.${focused.className}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const ownIndicator = focused.className.split(/\s+/).some((name) => OWN_INDICATOR.has(name));
        if (ownIndicator) continue;
        const onRing =
          focused.style === 'solid' &&
          focused.width === RING_WIDTH_PX &&
          focused.color === SIGNAL_RGB &&
          RING_OFFSETS_PX.includes(focused.offset);
        if (!onRing) {
          offenders.push(
            `${key}: ${focused.style} ${focused.width}px ${focused.color} offset ${focused.offset}px`,
          );
        }
      }
      expect(seen.size, 'the tab walk reached too few controls to prove anything').toBeGreaterThan(
        MIN_TARGETS,
      );
      expect(
        offenders,
        'a control draws its own focus ring instead of the shared --focus-ring token (2px solid signal, offset 2px, or -2px inset)',
      ).toEqual([]);
    });
  }
}
