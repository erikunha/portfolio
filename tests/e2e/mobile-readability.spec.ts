import { expect, test } from '@playwright/test';
import { VIEWPORTS } from './_helpers/geometry';
import { freezeMotion } from './_helpers/motion';
import { gotoSettled } from './_helpers/streamed';

const PHONE = { width: 375, height: 812 } as const;
const PHONES = [VIEWPORTS.PHONE_NARROW, PHONE, VIEWPORTS.PHONE] as const;
const READABLE_FLOOR_PX = 13;
const BODY_COPY_PX = 14;
const EDGE_TOLERANCE_PX = 1;
const SCROLLED_PX = 1200;
const OPAQUE = 1;

test.describe('mobile type floor', () => {
  for (const route of ['/', '/pt', '/links', '/design-system', '/cv', '/summary']) {
    test(`no visible text on ${route} at ${PHONE.width}px is smaller than ${READABLE_FLOOR_PX}px`, async ({
      page,
    }) => {
      await page.setViewportSize(PHONE);
      await gotoSettled(page, route);
      const offenders = await page.evaluate((floor) => {
        const found: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>('body *')) {
          if (!el.checkVisibility({ checkVisibilityCSS: true })) continue;
          const box = el.getBoundingClientRect();
          if (box.width <= 1 || box.height <= 1) continue;
          const ownText = [...el.childNodes].some(
            (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
          );
          if (!ownText) continue;
          const size = Number.parseFloat(getComputedStyle(el).fontSize);
          if (size < floor) found.push(`${el.tagName.toLowerCase()}.${el.className} ${size}px`);
        }
        return found;
      }, READABLE_FLOOR_PX);
      expect(offenders, 'phone text below 13px is unreadable at arm length').toEqual([]);
    });
  }

  test(`project descriptions read at ${BODY_COPY_PX}px on a phone`, async ({ page }) => {
    await page.setViewportSize(PHONE);
    await gotoSettled(page, '/');
    const sizes = await page
      .locator('.project-desc')
      .evaluateAll((nodes) =>
        nodes.map((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
      );
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(BODY_COPY_PX);
  });
});

test.describe('the back-to-top button sits on the dock', () => {
  for (const viewport of PHONES) {
    test(`at ${viewport.width}px its bottom edge meets the dock's top edge and nothing shows through`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await freezeMotion(page);
      await page.goto('/');
      await page.evaluate((top) => window.scrollTo(0, top), SCROLLED_PX);
      const button = page.locator('.to-top-btn');
      await expect(button).toHaveClass(/to-top-show/);
      const seat = await page.evaluate(() => {
        const btn = document.querySelector('.to-top-btn') as HTMLElement;
        const dock = document.querySelector('.dock') as HTMLElement;
        const background = getComputedStyle(btn).backgroundColor;
        const alpha = background.startsWith('rgba')
          ? Number.parseFloat(background.split(',')[3] ?? '1')
          : 1;
        return {
          gap: dock.getBoundingClientRect().top - btn.getBoundingClientRect().bottom,
          alpha,
        };
      });
      expect(
        Math.abs(seat.gap),
        'a button floating above the dock covers the content between them',
      ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
      expect(seat.alpha, 'the button is chrome: content must not show through it').toBe(OPAQUE);
    });
  }

  test('the last content of a page clears the button at the end of the scroll', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await freezeMotion(page);
    await gotoSettled(page, '/design-system');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.locator('.to-top-btn')).toHaveClass(/to-top-show/);
    const overlap = await page.evaluate(() => {
      const btn = (document.querySelector('.to-top-btn') as HTMLElement).getBoundingClientRect();
      const main = document.querySelector('main') as HTMLElement;
      const last = [...main.querySelectorAll<HTMLElement>('*')]
        .filter((el) => el.checkVisibility() && el.getBoundingClientRect().height > 0)
        .reduce((low, el) =>
          el.getBoundingClientRect().bottom > low.getBoundingClientRect().bottom ? el : low,
        );
      return btn.top - last.getBoundingClientRect().bottom;
    });
    expect(overlap, 'the page ends under the floating button').toBeGreaterThanOrEqual(0);
  });
});

test.describe('the drawer leads with the MOTION switch', () => {
  test(`at ${PHONE.width}px MOTION is the first row under the drawer head, on the first screen`, async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await gotoSettled(page, '/');
    await page
      .getByRole('navigation', { name: 'primary' })
      .getByRole('button', { name: /^MENU/ })
      .click();
    const drawer = page.getByRole('dialog', { name: 'Section menu' });
    const motion = drawer.locator('.menu-motion');
    await expect(motion).toBeInViewport({ ratio: 1 });
    const order = await drawer.evaluate((panel) => {
      const toggle = panel.querySelector('.menu-motion') as HTMLElement;
      const nav = panel.querySelector('#section-nav') as HTMLElement;
      return toggle.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING;
    });
    expect(order, 'MOTION must come before the section list').toBeTruthy();
  });
});

test.describe('the mobile hero', () => {
  for (const viewport of PHONES) {
    test(`at ${viewport.width}px the name carries no separator when the boot log is hidden`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      const state = await page.evaluate(() => {
        const hero = document.querySelector('[data-testid="hero-mobile"]') as HTMLElement;
        const boot = hero.querySelector('.hero-boot-mobile') as HTMLElement;
        const name = hero.querySelector('.hero-identity') as HTMLElement;
        const style = getComputedStyle(name);
        return {
          bootShown: boot.checkVisibility(),
          border: Number.parseFloat(style.borderTopWidth),
          space: Number.parseFloat(style.marginTop) + Number.parseFloat(style.paddingTop),
        };
      });
      if (state.bootShown) {
        expect(state.border, 'the separator divides the boot log from the name').toBeGreaterThan(0);
      } else {
        expect(state.border + state.space, 'an empty strip sits where the boot log was').toBe(0);
      }
    });
  }
});

test.describe('design-system ON THIS PAGE', () => {
  test(`at ${PHONE.width}px every entry is a link to a heading on the page`, async ({ page }) => {
    await page.setViewportSize(PHONE);
    await gotoSettled(page, '/design-system');
    const toc = page.getByRole('navigation', { name: 'On this page', exact: true });
    const entries = await toc.locator('li').evaluateAll((items) =>
      items.map((item) => {
        const link = item.querySelector('a');
        const target = link ? document.querySelector(link.getAttribute('href') ?? '') : null;
        const style = link ? getComputedStyle(link) : null;
        return {
          text: item.textContent?.trim(),
          linked: Boolean(link && target),
          underlined: style?.textDecorationLine.includes('underline') ?? false,
        };
      }),
    );
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.linked, `${entry.text} must link to its heading`).toBe(true);
      expect(entry.underlined, `${entry.text} must read as a link, not a label`).toBe(true);
    }
  });
});

test.describe('project cards at desktop width', () => {
  test(`at ${VIEWPORTS.DESKTOP.width}px the cards in a row share one height`, async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.DESKTOP);
    await gotoSettled(page, '/');
    const rows = await page.locator('.project-card').evaluateAll((cards) => {
      const byTop = new Map<number, number[]>();
      for (const card of cards) {
        const box = card.getBoundingClientRect();
        const top = Math.round(box.top + window.scrollY);
        byTop.set(top, [...(byTop.get(top) ?? []), Math.round(box.height)]);
      }
      return [...byTop.values()];
    });
    expect(rows.length).toBeGreaterThan(1);
    for (const heights of rows) expect(new Set(heights).size, `row heights ${heights}`).toBe(1);
  });

  test(`at ${VIEWPORTS.DESKTOP.width}px a wrapped stat value keeps its lines left-aligned`, async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.DESKTOP);
    await gotoSettled(page, '/');
    const ragged = await page.locator('.project-stats dd').evaluateAll((values) =>
      values.flatMap((value) => {
        const range = document.createRange();
        range.selectNodeContents(value);
        const lines = new Map<number, number>();
        for (const rect of range.getClientRects()) {
          const top = Math.round(rect.top);
          lines.set(top, Math.min(lines.get(top) ?? rect.left, rect.left));
        }
        const lefts = [...lines.values()].map(Math.round);
        return lefts.length > 1 && new Set(lefts).size > 1 ? [value.textContent] : [];
      }),
    );
    expect(ragged, 'wrapped values start every line at the same edge').toEqual([]);
  });
});
