import type { Page } from '@playwright/test';

const SCROLL_STEP_PX = 600;
const SCROLL_PAUSE_MS = 40;
const OPAQUE_ALPHA = 1;
const HAIRLINE_PX = 2;

export type Offender = { selector: string; background: string };

export async function scrollThroughPage(page: Page): Promise<void> {
  await page.evaluate(
    async ([step, pause]) => {
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, pause));
      }
      window.scrollTo(0, 0);
    },
    [SCROLL_STEP_PX, SCROLL_PAUSE_MS] as const,
  );
}

export function translucentSurfaces(page: Page, rootSelector: string) {
  return page.evaluate(
    ([selector, opaque, hairline]) => {
      const CONTROL_TAGS = new Set([
        'A',
        'BUTTON',
        'INPUT',
        'SELECT',
        'TEXTAREA',
        'KBD',
        'SUMMARY',
      ]);
      const alphaOf = (color: string): number => {
        const slash = color.match(/\/\s*([\d.]+)(%?)\s*\)/);
        if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1);
        const rgba = color.match(/^rgba\((?:[^,]+,){3}\s*([\d.]+)\)/);
        if (rgba) return Number(rgba[1]);
        return color === 'transparent' ? 0 : 1;
      };
      const isFullBox = (style: CSSStyleDeclaration): boolean =>
        [
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth,
        ].every((width) => Number.parseFloat(width) > 0);
      const isDivider = (el: Element, style: CSSStyleDeclaration): boolean => {
        const rect = el.getBoundingClientRect();
        return !isFullBox(style) && Math.min(rect.width, rect.height) <= hairline;
      };
      const isSurface = (el: Element, style: CSSStyleDeclaration): boolean =>
        !CONTROL_TAGS.has(el.tagName) &&
        el.getClientRects().length > 0 &&
        !isDivider(el, style) &&
        (isFullBox(style) ||
          alphaOf(style.backgroundColor) > 0 ||
          style.backgroundImage !== 'none');
      const hasOpaqueBacking = (el: Element, root: Element): boolean => {
        for (let node: Element | null = el; node; node = node.parentElement) {
          if (alphaOf(getComputedStyle(node).backgroundColor) >= opaque) return true;
          if (node === root) return false;
        }
        return false;
      };
      const nameOf = (el: Element): string =>
        `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${[...el.classList]
          .slice(0, 2)
          .map((name) => `.${name}`)
          .join('')}`;

      const root = document.querySelector(String(selector));
      if (!root) return null;
      for (const animation of document.getAnimations()) animation.cancel();
      const offenders: { selector: string; background: string }[] = [];
      for (const el of [root, ...root.querySelectorAll('*')]) {
        const style = getComputedStyle(el);
        if (!isSurface(el, style)) continue;
        if (hasOpaqueBacking(el, root)) continue;
        offenders.push({ selector: nameOf(el), background: style.backgroundColor });
      }
      return offenders;
    },
    [rootSelector, OPAQUE_ALPHA, HAIRLINE_PX] as const,
  ) as Promise<Offender[] | null>;
}
