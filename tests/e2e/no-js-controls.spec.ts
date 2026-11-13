import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

const ROUTES = [
  '/',
  '/pt',
  '/cv',
  '/pt/cv',
  '/summary',
  '/pt/summary',
  '/links',
  '/links/en',
  '/design-system',
  '/design-system/tokens',
  '/design-system/primitives/button',
  '/design-system/primitives/copybutton',
  '/design-system/foundations/typography',
  '/this-route-does-not-exist',
] as const;
const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 375, height: 800 },
] as const;
const SUBMIT = 'submit';

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`${route} at ${viewport.width}px offers no button that needs JavaScript`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(route);
      const dead = await page.evaluate((submit) => {
        return [...document.querySelectorAll('button')]
          .filter((button) => (button.getAttribute('type') ?? submit) !== submit)
          .filter((button) => button.checkVisibility({ checkVisibilityCSS: true }))
          .map((button) => (button.getAttribute('aria-label') ?? button.textContent ?? '').trim());
      }, SUBMIT);
      expect(
        dead,
        'with scripting off a click does nothing, so the control must not be drawn',
      ).toEqual([]);
    });
  }
}
