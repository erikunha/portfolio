import { expect, type Page, test } from '@playwright/test';
import { VIEWPORTS } from './_helpers/geometry';

const SECTION_IDS = [
  'bio',
  'sec-readme',
  'sec-shell',
  'sec-live-metrics',
  'sec-projects',
  'sec-git-log',
  'sec-hottest-takes',
  'sec-guitar',
  'sec-contact',
  'shutdown',
] as const;

const SURFACE_VIEWPORTS = [
  { name: 'desktop', size: VIEWPORTS.DESKTOP },
  { name: 'phone', size: VIEWPORTS.PHONE },
] as const;

const SCROLL_STEP_PX = 600;
const SCROLL_PAUSE_MS = 40;
const OPAQUE_ALPHA = 1;

type Offender = { selector: string; background: string };

async function loadEverySection(page: Page): Promise<void> {
  await page.goto('/');
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

function translucentSurfaces(page: Page, sectionId: string, opaqueAlpha: number) {
  return page.evaluate(
    ([id, opaque]) => {
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
      const isSurface = (el: Element, style: CSSStyleDeclaration): boolean =>
        !CONTROL_TAGS.has(el.tagName) &&
        el.getClientRects().length > 0 &&
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

      const root = document.getElementById(String(id));
      if (!root) return null;
      const offenders: { selector: string; background: string }[] = [];
      for (const el of [root, ...root.querySelectorAll('*')]) {
        const style = getComputedStyle(el);
        if (!isSurface(el, style)) continue;
        if (hasOpaqueBacking(el, root)) continue;
        offenders.push({ selector: nameOf(el), background: style.backgroundColor });
      }
      return offenders;
    },
    [sectionId, opaqueAlpha] as const,
  ) as Promise<Offender[] | null>;
}

test.describe('home section surfaces are opaque', () => {
  for (const { name, size } of SURFACE_VIEWPORTS) {
    test.describe(`${name} viewport`, () => {
      for (const sectionId of SECTION_IDS) {
        test(`${sectionId} panel and cards sit on an opaque backing`, async ({ page }) => {
          await page.setViewportSize(size);
          await loadEverySection(page);
          const offenders = await translucentSurfaces(page, sectionId, OPAQUE_ALPHA);
          expect(offenders, `${sectionId} exists`).not.toBeNull();
          expect(
            offenders,
            `Matrix Rain shows through ${sectionId}: every bordered or tinted surface needs an opaque background on itself or an ancestor inside the section`,
          ).toEqual([]);
        });
      }
    });
  }
});
