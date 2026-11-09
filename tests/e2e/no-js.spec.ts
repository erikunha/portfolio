import { expect, type Page, test } from '@playwright/test';
import { horizontalOverflow } from './_helpers/geometry';

test.use({ javaScriptEnabled: false });

test.describe('home with JavaScript off', () => {
  test('shows the notice and keeps the static content readable', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/This site works best with JavaScript/)).toBeVisible();
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('the Portuguese pages show the notice in Portuguese only', async ({ page }) => {
    for (const path of ['/pt', '/pt/cv', '/pt/summary']) {
      await page.goto(path);
      await expect(page.locator('.nojs-bar:visible')).toHaveCount(1);
      await expect(page.getByText(/Este site funciona melhor com JavaScript/)).toBeVisible();
      await expect(page.getByText(/This site works best with JavaScript/)).toBeHidden();
      await expect(page.locator('.nojs-bar:visible a')).toHaveAttribute('href', '/pt#sec-contact');
    }
  });

  test('the site navigation still moves to its section', async ({ page }) => {
    await page.goto('/');
    // The noscript bar link is the one contact route at every breakpoint; the dock HIRE leaves the site.
    await page.locator('.nojs-bar a[href="/#sec-contact"]').click();
    await expect(page).toHaveURL(/#sec-contact$/);
    await expect(page.locator('#sec-contact')).toBeAttached();
  });

  test('forms that need JavaScript are not offered, so a submit cannot put the message in the URL', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('contact-form')).toBeHidden();
    await expect(page.getByTestId('shell-form')).toBeHidden();
    await expect(page.getByTestId('contact-nojs')).toBeVisible();
  });

  test('the notice clears the fixed desktop chrome instead of covering it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    const topbar = await page.locator('.desktop-topbar').boundingBox();
    const bar = await page.locator('.nojs-bar').boundingBox();
    if (topbar === null || bar === null) {
      throw new Error('nojs-bar or desktop-topbar did not render a box');
    }
    expect(bar.y).toBeGreaterThanOrEqual(topbar.y + topbar.height);
    await expect(
      page.locator('.desktop-topbar').getByRole('link', { name: 'erikunha.dev, home' }),
    ).toBeInViewport();
    await expect(
      page.locator('.desktop-topbar').getByRole('link', { name: 'VIEW_CV' }),
    ).toBeInViewport();
  });

  test('the notice sits flush with the topbar on the horizontal axis', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    const topbar = await page.locator('.desktop-topbar').boundingBox();
    const bar = await page.locator('.nojs-bar').boundingBox();
    expect(topbar).not.toBeNull();
    expect(bar).not.toBeNull();
    expect(
      bar?.x,
      'the noscript notice must share the left edge of the fixed topbar, the collapsed rail that offset it is gone',
    ).toBe(topbar?.x);
  });

  test('no section rail is pinned open at wide desktop without JS', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/');
    await expect(
      page.locator('.section-menu'),
      'the menu opens only from the menu button',
    ).toBeHidden();
  });

  test('the contact section keeps its channels, facts and static map in order', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const section = page.locator('#sec-contact');

    await expect(section.locator('.contact-channels a[href^="mailto:"]')).toBeAttached();
    await expect(section.locator('.contact-fact')).toHaveCount(5);
    await expect(section.getByTestId('contact-timezone-static')).toBeAttached();
    await expect(section.getByTestId('ctz-clock-erik')).toHaveCount(0);
    const inOrder = await section.evaluate((element) => {
      const follows = (first: string, second: string) =>
        Boolean(
          (element.querySelector(first) as Element).compareDocumentPosition(
            element.querySelector(second) as Element,
          ) & Node.DOCUMENT_POSITION_FOLLOWING,
        );
      return (
        follows('.contact-main > :first-child', '.contact-channels') &&
        follows('.contact-channels', '.contact-facts') &&
        follows('.contact-facts', '.contact-timezone')
      );
    });
    expect(inOrder, 'form, channels, facts, panel').toBe(true);
    const overflow = await horizontalOverflow(page);
    expect(overflow, 'the page does not scroll sideways').toBeLessThanOrEqual(0);
  });

  test('the server-rendered menu trigger is the icon alone, named Open menu', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    const trigger = page.locator('.desktop-topbar .menu-trigger');
    await expect(trigger).toHaveAccessibleName('Open menu');
    await expect(trigger).toHaveText('');
    await expect(page.locator('.desktop-topbar')).not.toContainText('INDEX');
  });
});

const EQ_BAR = '[data-testid="eq-spectrum"] .eq-bar';
const TICKER_TRACK_CLASS = 'links-ticker-track';
const NO_ANIMATION = 'none';

const animationName = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((node) => getComputedStyle(node).animationName);

test.describe('home with JavaScript off and the system asking for reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing animates, because no script can offer the MOTION switch', async ({ page }) => {
    await page.goto('/');
    await page.locator(EQ_BAR).first().scrollIntoViewIfNeeded();
    expect(
      await animationName(page, EQ_BAR),
      'WCAG 2.2.2: with no script there is no MOTION switch, so the system setting must stop the animation',
    ).toBe(NO_ANIMATION);
  });

  test('the links ticker becomes one static line', async ({ page }) => {
    await page.goto('/');
    await page.evaluate((trackClass) => {
      const track = document.createElement('div');
      track.className = trackClass;
      track.style.width = '200px';
      track.innerHTML = '<span>one</span><span>two</span>';
      document.body.append(track);
    }, TICKER_TRACK_CLASS);
    expect(await animationName(page, `.${TICKER_TRACK_CLASS}`)).toBe(NO_ANIMATION);
    await expect(page.locator(`.${TICKER_TRACK_CLASS} > span`).nth(1)).toBeHidden();
    expect(
      await page
        .locator(`.${TICKER_TRACK_CLASS}`)
        .evaluate((node) => getComputedStyle(node).whiteSpace),
    ).toBe('normal');
  });
});

test.describe('home with JavaScript off and no system preference', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the animation is left running', async ({ page }) => {
    await page.goto('/');
    await page.locator(EQ_BAR).first().scrollIntoViewIfNeeded();
    expect(await animationName(page, EQ_BAR)).not.toBe(NO_ANIMATION);
  });
});
