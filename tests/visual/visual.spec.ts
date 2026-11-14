import { shellUi } from '../../content/shell-ui';
import { SITE_LOCALE } from '../../content/site-locale';
import { captureForArgos } from '../e2e/_helpers/argos-capture';
import { expect, test } from '../e2e/_helpers/fixtures';
import { waitForHydration } from '../e2e/_helpers/hydration';
import { stripVolatileChrome } from '../e2e/_helpers/mask-volatile';
import { revealDeferredContent, snapshotLocator } from '../e2e/_helpers/snapshot';
import { gotoSettled } from '../e2e/_helpers/streamed';

test.describe.configure({ timeout: 60_000 });

const CONTACT_VISITOR_ZONE = 'Europe/Berlin';
const CONTACT_FIXED_NOW = new Date('2026-11-02T15:00:00Z');
const CONTACT_SCROLL_MARGIN_PX = 100;
const PAGE_VIEWPORT = {
  chromium: { width: 1280, height: 720 },
  'chromium-mobile': { width: 390, height: 844 },
} as const;
const PAGE_BASELINES = [
  { name: 'cv', path: '/cv', target: 'main' },
  { name: 'summary', path: '/summary', target: 'main' },
  { name: 'links-en', path: '/links/en', target: 'main' },
  {
    name: 'pt-hero',
    path: '/pt',
    target: '[data-testid="hero-desktop"], [data-testid="hero-mobile"]',
  },
] as const;

test.describe('visual regression', () => {
  test('1: hero above-the-fold matches baseline', async ({ mockedPage }, testInfo) => {
    test.skip(
      testInfo.project.name === 'chromium-mobile',
      'chromium-mobile post-hydration reflow blocks stable hero snapshot.',
    );

    const heroSection = mockedPage
      .locator('[data-testid="hero-desktop"], [data-testid="hero-mobile"]')
      .filter({ visible: true })
      .first();
    await heroSection.waitFor({ state: 'visible' });
    await heroSection.scrollIntoViewIfNeeded();
    await mockedPage.evaluate(() => document.fonts.ready);
    await heroSection.locator('[data-testid="hero-ctas"]').waitFor({ state: 'visible' });
    await stripVolatileChrome(mockedPage);
    if (process.env.ARGOS_TOKEN) {
      await revealDeferredContent(mockedPage);
      await captureForArgos(mockedPage, 'hero-above-fold', heroSection);
    }
    await snapshotLocator(mockedPage, heroSection, 'hero-above-fold.png');
  });

  test.describe('contact section', () => {
    test.use({ timezoneId: CONTACT_VISITOR_ZONE, locale: 'en-US' });

    test('2: contact section matches baseline', async ({ mockedPage }) => {
      await mockedPage.clock.setFixedTime(CONTACT_FIXED_NOW);
      const contactSection = mockedPage.locator('#sec-contact');
      const scrollToContact = (selector: string) =>
        mockedPage.evaluate(
          ({ target, margin }) =>
            window.scrollTo(
              0,
              (document.querySelector(target) as HTMLElement).getBoundingClientRect().top +
                window.scrollY -
                margin,
            ),
          { target: selector, margin: CONTACT_SCROLL_MARGIN_PX },
        );
      await scrollToContact('.contact-timezone');
      await mockedPage.waitForSelector('[data-testid="contact-timezone"]', { state: 'visible' });
      await scrollToContact('#sec-contact');
      await mockedPage.waitForSelector('[data-testid="contact-form"]', { state: 'visible' });
      await mockedPage.evaluate(() => document.fonts.ready);
      await stripVolatileChrome(mockedPage);
      if (process.env.ARGOS_TOKEN) {
        await revealDeferredContent(mockedPage);
        await captureForArgos(mockedPage, 'contact-section', contactSection);
      }
      await snapshotLocator(mockedPage, contactSection, 'contact-section.png');
    });
  });

  test('3: shell + ask form (idle) matches baseline', async ({ mockedPage }, testInfo) => {
    const shellSection = mockedPage.locator('#sec-shell');
    await shellSection.scrollIntoViewIfNeeded();
    await mockedPage.waitForSelector('[data-testid="shell-form"]', { state: 'visible' });
    await mockedPage.waitForSelector('[role="log"] [data-kind="info"]', { state: 'visible' });
    await mockedPage.waitForSelector('[data-testid="shell-line-loading"]', { state: 'detached' });
    // The server sends the desktop welcome and the client swaps it for the
    // narrow one once it reads the real viewport. Capturing before that swap
    // lands would photograph a different page on a narrow screen.
    await waitForHydration(mockedPage, '[data-testid="shell-form"]');
    const welcome = testInfo.project.name.includes('mobile')
      ? shellUi[SITE_LOCALE.en].mobileWelcome
      : shellUi[SITE_LOCALE.en].welcome;
    await expect(mockedPage.locator('[role="log"]')).toContainText(welcome);
    await mockedPage.evaluate(() => document.fonts.ready);
    await mockedPage.evaluate(() => {
      const ph = document.querySelector('[data-testid="shell-placeholder"]');
      if (ph) (ph as HTMLElement).style.visibility = 'hidden';
    });
    await stripVolatileChrome(mockedPage);
    if (process.env.ARGOS_TOKEN) {
      await revealDeferredContent(mockedPage);
      await captureForArgos(mockedPage, 'shell-idle', shellSection);
    }
    await snapshotLocator(mockedPage, shellSection, 'shell-idle.png');
  });

  test('4: shell + ask form (mid-stream) matches baseline', async ({ mockedPage }) => {
    await mockedPage.addInitScript(() => {
      const realFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : (input as Request).url;
        if (url.includes('/api/ask')) {
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('Erik is a Senior'));
            },
          });
          return new Response(stream, {
            status: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'X-Request-Id': 'visual-mid-stream-id',
            },
          });
        }
        return realFetch(input, init);
      };
    });
    await mockedPage.reload();
    await mockedPage.waitForSelector('[aria-label="shell command"]', { state: 'visible' });
    await waitForHydration(mockedPage, '[data-testid="shell-form"]');

    const shellSection = mockedPage.locator('#sec-shell');
    await shellSection.scrollIntoViewIfNeeded();
    const input = mockedPage.locator('[aria-label="shell command"]').first();
    await input.fill('who is erik');
    await input.press('Enter');

    const outputLine = mockedPage.locator('[role="log"] [data-kind="output"]');
    await expect(outputLine).toContainText('Erik is a Senior', { timeout: 10_000 });
    await mockedPage.evaluate(() => document.fonts.ready);
    await mockedPage.evaluate(() => {
      const ph = document.querySelector('[data-testid="shell-placeholder"]');
      if (ph) (ph as HTMLElement).style.visibility = 'hidden';
    });
    await stripVolatileChrome(mockedPage);
    await mockedPage.evaluate(() => {
      for (const time of document.querySelectorAll<HTMLElement>('.shell-stop-time')) {
        time.style.visibility = 'hidden';
      }
    });
    if (process.env.ARGOS_TOKEN) {
      await revealDeferredContent(mockedPage);
      await mockedPage.evaluate(() => {
        for (const el of document.querySelectorAll('[aria-busy="true"]')) {
          el.removeAttribute('aria-busy');
        }
      });
      await captureForArgos(mockedPage, 'shell-mid-stream', shellSection);
    }
    await snapshotLocator(mockedPage, shellSection, 'shell-mid-stream.png');
  });

  test('5: hottest takes section matches baseline', async ({ mockedPage }) => {
    const hottest = mockedPage.locator('#sec-hottest-takes');
    await hottest.scrollIntoViewIfNeeded();
    await mockedPage.waitForSelector('#sec-hottest-takes [data-testid="hottest-takes-list"]', {
      state: 'visible',
    });
    await mockedPage.evaluate(() => document.fonts.ready);
    await stripVolatileChrome(mockedPage);
    if (process.env.ARGOS_TOKEN) {
      await revealDeferredContent(mockedPage);
      await captureForArgos(mockedPage, 'hottest-takes-section', hottest);
    }
    await snapshotLocator(mockedPage, hottest, 'hottest-takes-section.png');
  });

  test('footer matches baseline', async ({ mockedPage }) => {
    const footer = mockedPage.locator('footer');
    await footer.scrollIntoViewIfNeeded();
    await mockedPage.evaluate(() => document.fonts.ready);
    await stripVolatileChrome(mockedPage);
    if (process.env.ARGOS_TOKEN) {
      await revealDeferredContent(mockedPage);
      await captureForArgos(mockedPage, 'footer', footer);
    }
    await snapshotLocator(mockedPage, footer, 'footer.png');
  });
});

test.describe('route page baselines', () => {
  for (const { name, path, target } of PAGE_BASELINES) {
    test(`${name} matches baseline`, async ({ mockedPage }, testInfo) => {
      const viewport = PAGE_VIEWPORT[testInfo.project.name as keyof typeof PAGE_VIEWPORT];
      await mockedPage.setViewportSize(viewport);
      await gotoSettled(mockedPage, path);
      await waitForHydration(mockedPage, '.menu-trigger');
      const region = mockedPage.locator(target).filter({ visible: true }).first();
      await region.waitFor({ state: 'visible' });
      await region.scrollIntoViewIfNeeded();
      await mockedPage.evaluate(() => document.fonts.ready);
      await stripVolatileChrome(mockedPage);
      await snapshotLocator(mockedPage, region, `${name}.png`);
    });
  }
});
