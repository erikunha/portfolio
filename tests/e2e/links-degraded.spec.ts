import { expect, test } from '@playwright/test';
import { linksContent } from '@/content/links';
import { LINKS_PATH, type LinksLocale } from '@/content/links.constants';
import { horizontalOverflow, VIEWPORTS } from './_helpers/geometry';
import { gotoHydrated } from './_helpers/hydration';
import { freezeMotion } from './_helpers/motion';

const LOCALES: readonly LinksLocale[] = ['pt', 'en'];
const COPY_LINK_BUTTON = 'button.links-line';
const SUBSCRIBE_LINK = '[data-outbound="inscrever"]';
const TAP_TARGET_PX = 44;
const SUBSCRIBED_KEY = 'links.subscribed';

for (const locale of LOCALES) {
  const { copy } = linksContent;
  const path = LINKS_PATH[locale];

  test.describe(`${path} with JavaScript off`, () => {
    test.use({ javaScriptEnabled: false, viewport: VIEWPORTS.PHONE });

    test('keeps the heading, the subscribe link and the profile links usable', async ({ page }) => {
      await page.goto(path);

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(copy.pageHeading[locale]);
      await expect(
        page.locator('[data-col="channel-loading"]'),
        'the loading skeleton waits for a swap only a script can make, so it must not stay on screen',
      ).toBeHidden();
      const subscribe = page.locator(`${SUBSCRIBE_LINK}:visible`);
      await expect(subscribe).toHaveCount(1);
      await expect(subscribe).toHaveAttribute('href', /youtube\.com\/.*sub_confirmation=1/);
      await expect(subscribe).toHaveAttribute('target', '_blank');
      expect((await subscribe.boundingBox())?.height).toBeGreaterThanOrEqual(TAP_TARGET_PX);
      await expect(page.getByTestId('links-contact').getByRole('link').first()).toBeVisible();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });

    test('shows no control that does nothing without a script', async ({ page }) => {
      await page.goto(path);

      await expect(page.locator(COPY_LINK_BUTTON).first()).toBeAttached();
      await expect(
        page.locator(`${COPY_LINK_BUTTON}:visible`),
        'a copy button is a dead control until a script attaches its handler, so it must stay hidden',
      ).toHaveCount(0);
    });
  });

  test.describe(`${path} with JavaScript on and MOTION off`, () => {
    test.use({ viewport: VIEWPORTS.PHONE });

    test('renders whole, with a working subscribe link and copy button', async ({ page }) => {
      await freezeMotion(page);
      await gotoHydrated(page, path, COPY_LINK_BUTTON);

      await expect(page.locator('body')).toHaveAttribute('data-motion', 'reduce');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(copy.pageHeading[locale]);
      await expect(page.locator('.links-identity-tagline')).toContainText(
        linksContent.profile.taglines[locale][0] ?? '',
      );

      const subscribe = page.locator(SUBSCRIBE_LINK);
      const label = subscribe.locator('.links-cta-label > span');
      await expect(label).toHaveText(copy.subscribe[locale]);
      const popupPromise = page.waitForEvent('popup');
      await subscribe.click();
      const popup = await popupPromise;
      await popup.close();
      await expect(label).toHaveText(copy.subscribedCta[locale]);
      expect(
        await page.evaluate((key) => localStorage.getItem(key), SUBSCRIBED_KEY),
        'the subscribe click is remembered',
      ).toBe('1');

      await expect(page.locator(COPY_LINK_BUTTON).first()).toBeVisible();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  });
}
