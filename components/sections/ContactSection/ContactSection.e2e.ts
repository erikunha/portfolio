import { expect, type Page, test } from '@playwright/test';
import { contactCopy } from '@/content/contact-copy';

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
const SCROLL_MARGIN_PX = 100;
const COMPACT_TARGET_PX = 28;
const TOUCH_TARGET_PX = 44;

async function scrollToCard(page: Page): Promise<void> {
  await page.evaluate(
    (margin) =>
      window.scrollTo(
        0,
        (document.querySelector('.contact-channels') as HTMLElement).getBoundingClientRect().top +
          window.scrollY -
          margin,
      ),
    SCROLL_MARGIN_PX,
  );
}

test.describe('ContactSection', () => {
  test('the channels card fills the right column and scrolls with the page at 1280', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    const card = page.locator('.contact-channels');
    await expect(card).toBeVisible();

    const layout = await page.locator('.contact-layout').evaluate((element) => {
      const columns = getComputedStyle(element).gridTemplateColumns.split(' ');
      const form = element.querySelector('.contact-main')?.getBoundingClientRect();
      const cardElement = element.querySelector('.contact-channels') as Element;
      return {
        columns,
        formRight: form?.right ?? 0,
        cardLeft: cardElement.getBoundingClientRect().left,
        position: getComputedStyle(cardElement).position,
        height: cardElement.getBoundingClientRect().height,
        viewport: window.innerHeight,
      };
    });

    expect(layout.columns, 'the form and the card split the row 7fr to 5fr').toHaveLength(2);
    expect(layout.cardLeft, 'the card sits in its own column, right of the form').toBeGreaterThan(
      layout.formRight,
    );
    expect(layout.height, 'the card is taller than the viewport').toBeGreaterThan(layout.viewport);
    expect(layout.position, 'a card taller than the viewport scrolls instead of sticking').toBe(
      'static',
    );
  });

  test('the card holds the timezone panel and the footer channels', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    const card = page.locator('.contact-channels');
    await scrollToCard(page);
    await expect(card.getByTestId('contact-timezone')).toBeVisible();

    const footer = card.locator('.ctz-footer');
    await expect(footer.locator('.ctz-fact')).toHaveCount(7);
    await expect(footer.locator('a[href^="mailto:"]')).toBeVisible();
    await expect(footer.getByRole('button', { name: contactCopy.section.copyEmail })).toBeVisible();
    await expect(footer.getByRole('link', { name: /MESSAGE_ON_LINKEDIN/ })).toHaveAttribute(
      'href',
      contactCopy.section.linkedinHref,
    );
    await expect(
      footer.getByRole('link', { name: contactCopy.channels.githubAccessibleLabel }),
    ).toBeVisible();
  });

  test('the channels card stacks under the form at 390', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');
    const card = page.locator('.contact-channels');
    await expect(card).toBeVisible();
    const boxes = await page.locator('.contact-main').evaluate((element) => {
      const card = document.querySelector('.contact-channels')?.getBoundingClientRect();
      return {
        formBottom: element.getBoundingClientRect().bottom,
        cardTop: card?.top ?? 0,
        columns: getComputedStyle(element.parentElement as Element).gridTemplateColumns.split(' ')
          .length,
      };
    });
    expect(boxes.columns, 'one column on a phone').toBe(1);
    expect(boxes.cardTop, 'the card sits below the form').toBeGreaterThanOrEqual(boxes.formBottom);
    await scrollToCard(page);
    await expect(card.getByTestId('contact-timezone')).toBeVisible();
  });

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
