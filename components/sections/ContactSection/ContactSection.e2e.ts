import { expect, type Page, test } from '@playwright/test';
import { contactCopy } from '@/content/contact-copy';

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
const SCROLL_MARGIN_PX = 100;
const COMPACT_TARGET_PX = 28;
const TOUCH_TARGET_PX = 44;
const FACT_COUNT = 6;
const SAME_LINE_PX = 4;
const MAX_COLUMN_RATIO = 1.25;
const MAX_HEIGHT_RATIO = 1.3;

async function scrollToSelector(page: Page, selector: string): Promise<void> {
  await page.evaluate(
    ({ target, margin }) =>
      window.scrollTo(
        0,
        (document.querySelector(target) as HTMLElement).getBoundingClientRect().top +
          window.scrollY -
          margin,
      ),
    { target: selector, margin: SCROLL_MARGIN_PX },
  );
}

test.describe('ContactSection', () => {
  test('the form column leads and the panel column follows at 1280', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    await expect(page.locator('.contact-timezone')).toBeVisible();

    const layout = await page.locator('.contact-layout').evaluate((element) => {
      const main = element.querySelector('.contact-main') as Element;
      const panel = element.querySelector('.contact-timezone') as Element;
      const mainBox = main.getBoundingClientRect();
      const panelBox = panel.getBoundingClientRect();
      return {
        columns: getComputedStyle(element).gridTemplateColumns.split(' '),
        mainWidth: mainBox.width,
        panelWidth: panelBox.width,
        mainRight: mainBox.right,
        panelLeft: panelBox.left,
        mainHeight: mainBox.height,
        panelHeight: panelBox.height,
        position: getComputedStyle(panel).position,
      };
    });

    expect(layout.columns, 'two columns').toHaveLength(2);
    expect(layout.panelLeft, 'the panel sits right of the form column').toBeGreaterThan(
      layout.mainRight,
    );
    expect(layout.mainWidth, 'the form column is the wider one').toBeGreaterThan(layout.panelWidth);
    expect(layout.mainWidth / layout.panelWidth, 'about 815 to 750').toBeLessThan(MAX_COLUMN_RATIO);
    expect(layout.position, 'the panel scrolls with the page').toBe('static');
    expect(
      Math.max(layout.mainHeight, layout.panelHeight) /
        Math.min(layout.mainHeight, layout.panelHeight),
      'neither column leaves the other half empty',
    ).toBeLessThan(MAX_HEIGHT_RATIO);
  });

  test('the channels block follows the form in the left column with six facts under it', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    const main = page.locator('.contact-main');
    await scrollToSelector(page, '.contact-channels');
    const channels = main.locator('.contact-channels');
    await expect(channels.getByRole('heading', { name: contactCopy.channels.title })).toBeVisible();
    await expect(channels.locator('a[href^="mailto:"]')).toBeVisible();
    await expect(
      channels.getByRole('button', { name: contactCopy.section.copyEmail }),
    ).toBeVisible();
    await expect(channels.getByRole('link', { name: /MESSAGE_ON_LINKEDIN/ })).toHaveAttribute(
      'href',
      contactCopy.section.linkedinHref,
    );
    await expect(
      channels.getByRole('link', { name: contactCopy.channels.githubAccessibleLabel }),
    ).toBeVisible();
    await expect(main.locator('.ctz-footer .ctz-fact')).toHaveCount(FACT_COUNT);
    await expect(main.locator('.ctz-fact dt', { hasText: /^tz$/ })).toHaveCount(0);
    await expect(main.locator('footer')).toHaveCount(0);
  });

  test('the timezone panel holds the clocks and no channel at 1280', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    const panel = page.locator('.contact-timezone');
    await scrollToSelector(page, '.contact-timezone');
    await expect(panel.getByRole('heading', { name: contactCopy.timezone.title })).toBeVisible();
    await expect(panel.getByTestId('contact-timezone')).toBeVisible();
    await expect(panel.locator('a[href^="mailto:"]')).toHaveCount(0);
    await expect(panel.locator('.ctz-fact')).toHaveCount(0);
  });

  test('the blocks stack form, channels, facts, panel at 390', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');
    await expect(page.locator('.contact-timezone')).toBeVisible();
    const tops = await page.locator('.contact-layout').evaluate((element) => {
      const top = (selector: string) =>
        (element.querySelector(selector) as Element).getBoundingClientRect().top;
      return {
        columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
        form: top('.contact-main > :first-child'),
        channels: top('.contact-channels'),
        facts: top('.ctz-facts'),
        panel: top('.contact-timezone'),
      };
    });

    expect(tops.columns, 'one column on a phone').toBe(1);
    expect(tops.channels, 'channels come after the form').toBeGreaterThan(tops.form);
    expect(tops.facts, 'facts come after the channels').toBeGreaterThan(tops.channels);
    expect(tops.panel, 'the panel comes after the facts').toBeGreaterThan(tops.facts);
  });

  test('the channel links and the copy button are touch targets on a phone', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');
    await scrollToSelector(page, '.contact-channels');
    const channels = page.locator('.contact-channels');
    const targets = [
      channels.locator('a[href^="mailto:"]'),
      channels.getByRole('button', { name: contactCopy.section.copyEmail }),
      channels.getByRole('link', { name: /MESSAGE_ON_LINKEDIN/ }),
      channels.getByRole('link', { name: contactCopy.channels.githubAccessibleLabel }),
    ];

    for (const target of targets) {
      await expect(target).toBeVisible();
      const box = await target.boundingBox();
      expect(box?.height ?? 0, 'at least 44px tall').toBeGreaterThanOrEqual(TOUCH_TARGET_PX);
    }
  });

  for (const width of [1024, 1100, 1280]) {
    test(`each fact keeps its label on the value's line at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await scrollToSelector(page, '.ctz-facts');
      const rows = await page.locator('.ctz-fact').evaluateAll((facts) =>
        facts.map((fact) => {
          const label = fact.querySelector('dt')?.getBoundingClientRect();
          const value = fact.querySelector('dd')?.getBoundingClientRect();
          return {
            label: fact.querySelector('dt')?.textContent,
            lineOffset: Math.abs((label?.top ?? 0) - (value?.top ?? 0)),
            labelRight: label?.right ?? 0,
            valueLeft: value?.left ?? 0,
          };
        }),
      );

      expect(rows).toHaveLength(FACT_COUNT);
      for (const row of rows) {
        expect(
          row.lineOffset,
          `${row.label} sits on the first line of its value`,
        ).toBeLessThanOrEqual(SAME_LINE_PX);
        expect(row.valueLeft, `${row.label} value starts right of its label`).toBeGreaterThan(
          row.labelRight,
        );
      }
    });
  }

  for (const width of [900, 1024, 1100]) {
    test(`the two clocks stay side by side at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await scrollToSelector(page, '.contact-timezone');
      const erik = page.getByTestId('ctz-clock-erik');
      const you = page.getByTestId('ctz-clock-you');
      await expect(erik).toBeVisible();
      await expect(you).toBeVisible();
      const [erikBox, youBox] = await Promise.all([erik.boundingBox(), you.boundingBox()]);

      expect(
        Math.abs((erikBox?.y ?? 0) - (youBox?.y ?? 0)),
        'both clocks share a row',
      ).toBeLessThanOrEqual(SAME_LINE_PX);
      expect((youBox?.x ?? 0) > (erikBox?.x ?? 0) + (erikBox?.width ?? 0)).toBe(true);
    });
  }

  test('the error summary reads as one line and draws no focus ring', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    await page
      .locator('#sec-contact form')
      .getByRole('button', { name: /EXECUTE_SEND/ })
      .click();
    const summary = page.locator('.contact-alert');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('3 fields need attention:');
    await expect(summary.locator('ul')).toHaveCount(0);
    await expect(summary.locator('a')).toHaveCount(3);

    const outline = await summary.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });
    expect(
      outline.style,
      'the summary is a container, not a control: it draws no focus ring of its own',
    ).toBe('none');
  });

  test('the contact copy control sits next to the address', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    const row = page.locator('.contact-channels-body > div').first();
    const address = row.locator('a[href^="mailto:"]');
    const copy = row.getByRole('button', { name: contactCopy.section.copyEmail });
    await expect(address).toBeVisible();
    await expect(copy).toBeVisible();
    const boxes = await row.evaluate((element) => {
      const link = element.querySelector('a')?.getBoundingClientRect();
      const button = element.querySelector('button')?.getBoundingClientRect();
      return {
        linkRight: link?.right ?? 0,
        buttonLeft: button?.left ?? 0,
        linkCenter: (link?.top ?? 0) + (link?.height ?? 0) / 2,
        buttonCenter: (button?.top ?? 0) + (button?.height ?? 0) / 2,
        buttonHeight: button?.height ?? 0,
        touch: matchMedia('(pointer: coarse)').matches,
      };
    });
    expect(
      boxes.buttonLeft,
      'the copy control sits beside the address, not under it',
    ).toBeGreaterThanOrEqual(boxes.linkRight);
    expect(
      Math.abs(boxes.buttonCenter - boxes.linkCenter),
      'the copy control shares the address line',
    ).toBeLessThanOrEqual(2);
    expect(
      boxes.buttonHeight,
      'the copy control is compact with a fine pointer and a touch target with a coarse one',
    ).toBeLessThanOrEqual(boxes.touch ? TOUCH_TARGET_PX : COMPACT_TARGET_PX);
  });
});
