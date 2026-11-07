import { expect, type Page, test } from '@playwright/test';
import { SITE_HTML_LANG, SITE_LOCALE } from '@/content/site-locale';
import { gotoSettled } from './_helpers/streamed';

const LANGUAGE_NAV_NAME = /^(Idioma|Language)$/;
const LANGUAGE_LINK_COUNT = 2;
const TAGLINE_FRAME_MS = 150;
const TAGLINE_HYDRATION_TIMEOUT_MS = 20_000;

const languageSwitch = (page: Page) => page.getByRole('navigation', { name: LANGUAGE_NAV_NAME });

test.describe('/links link-in-bio', () => {
  test('the language switch is real routing, not a client-side toggle', async ({ page }) => {
    await page.goto('/links');
    await expect(page.locator('h1')).toHaveText(/links, canal e contato/);

    await languageSwitch(page).getByRole('link', { name: 'English' }).click();
    await page.waitForURL('**/links/en');
    await expect(page.locator('h1')).toHaveText(/links, channel and contact/);

    await languageSwitch(page).getByRole('link', { name: 'Português' }).click();
    await page.waitForURL(/\/links$/);
  });

  test('marks the active language for assistive tech', async ({ page }) => {
    await page.goto('/links/en');
    const switcher = languageSwitch(page);
    await expect(switcher.getByRole('link')).toHaveCount(LANGUAGE_LINK_COUNT);
    await expect(switcher.getByRole('link', { name: 'English' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(switcher.getByRole('link', { name: 'Português' })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('declares the document language of each route to screen readers', async ({ page }) => {
    await page.goto('/links');
    await expect(page.locator('html')).toHaveAttribute('lang', SITE_HTML_LANG[SITE_LOCALE.pt]);

    await page.goto('/links/en');
    await expect(page.locator('html')).toHaveAttribute('lang', SITE_HTML_LANG[SITE_LOCALE.en]);
  });

  test('serves a scannable QR from the server with no client-side canvas work', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/links');
    const qr = page.getByRole('img', { name: /QR code|Código QR/ });
    await expect(qr).toBeVisible();
    expect(await qr.evaluate((el) => el.tagName.toLowerCase())).not.toBe('canvas');
    await expect(qr.locator('canvas')).toHaveCount(0);
    await expect(
      page.locator('canvas:not([aria-hidden="true"])'),
      'only the decorative, aria-hidden Matrix Rain may draw on a canvas; the QR must arrive server-rendered',
    ).toHaveCount(0);
  });

  test('drops the QR panel on a phone, where the visitor is already holding the page', async ({
    page,
  }) => {
    const qr = page.getByRole('img', { name: /QR code|Código QR/ });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/links');
    await expect(
      qr,
      'the QR panel shows on a desktop, so the locator is the real one',
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(qr).toBeHidden();
  });

  test('paints the hatch through the frame when the portrait fails to load', async ({ page }) => {
    await page.route('**/_next/image**', (route) => route.abort());
    await page.goto('/links');

    const frame = page.locator('.links-avatar');
    const img = page.locator('.links-avatar img');

    // Guards the rest of the test: if the abort stops taking effect the portrait paints over
    // the hatch, and every assertion below would pass for the wrong reason.
    await expect(
      img,
      'the optimizer request was meant to fail here; a loaded portrait makes this test vacuous',
    ).toHaveJSProperty('naturalWidth', 0);

    // Reading `background-image` off the span proves only that the declaration exists, which
    // nothing disputes. Diffing the rendered pixels against the same frame with the hatch
    // suppressed is what proves it actually paints in this state.
    const painted = await frame.screenshot();
    await page.addStyleTag({
      content: '.links-avatar { background-image: none !important; }',
    });
    const suppressed = await frame.screenshot();

    expect(
      painted.equals(suppressed),
      'the .links-avatar hatch is what the frame degrades to when the portrait 404s, the way .links-thumb-placeholder covers the video thumbnails. Identical pixels with and without it mean it contributes nothing and the frame is an empty box.',
    ).toBe(false);
  });

  test('gives every interactive control a visible focus ring', async ({ page }) => {
    await gotoSettled(page, '/links');
    const controls = page.locator('a:visible, button:visible');
    const count = await controls.count();
    expect(count).toBeGreaterThan(10);

    for (let i = 0; i < count; i++) {
      const control = controls.nth(i);
      await control.focus();
      const width = await control.evaluate((el) => {
        const style = getComputedStyle(el);
        return Number.parseFloat(style.outlineWidth) || 0;
      });
      expect(
        width,
        `control ${i} (${((await control.textContent()) ?? '').trim().slice(0, 30)})`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  test('sizes every block tap target at 44px or more', async ({ page }) => {
    await gotoSettled(page, '/links');
    const targets = page.locator(
      'nav a:visible, [data-testid="links-pills"] a:visible, [data-testid="links-pills"] button:visible, [data-outbound="inscrever"]:visible',
    );
    const count = await targets.count();
    expect(count).toBeGreaterThan(5);

    for (let i = 0; i < count; i++) {
      const box = await targets.nth(i).boundingBox();
      expect(
        box?.height ?? 0,
        `standalone tap target ${i} is under 44px. This selector deliberately covers the nav, the link pills and the subscribe CTA only: a link sitting inline inside a sentence is exempt from target-size minimums, so widening this to every anchor would fail on the footer's inline erikunha.dev link for no accessibility gain.`,
      ).toBeGreaterThanOrEqual(44);
    }
  });

  test('never links a pill whose destination is unconfirmed', async ({ page }) => {
    await page.goto('/links');
    expect(await page.locator('a[href="#"], a[href=""]').count()).toBe(0);
  });

  test('types the tagline, and holds the full first phrase under reduced motion', async ({
    page,
  }) => {
    const title = 'Engenheiro de Software Sênior, IA Aplicada';
    const identity = page.locator('.links-identity-box');

    await page.clock.install();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/links');
    await expect(identity).toContainText(title);
    const first = await identity.textContent();
    await page.clock.runFor(600);
    expect(await identity.textContent(), 'reduced motion must not type').toBe(first);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.reload();
    const samples = new Set<string | null>();
    await expect
      .poll(
        async () => {
          samples.add(await identity.textContent());
          await page.clock.runFor(TAGLINE_FRAME_MS);
          return samples.size;
        },
        {
          message: 'the tagline must type when motion is allowed',
          timeout: TAGLINE_HYDRATION_TIMEOUT_MS,
        },
      )
      .toBeGreaterThan(1);
  });

  test('renders the English title on the English route', async ({ page }) => {
    await page.goto('/links/en');
    await expect(page.locator('.links-identity-box')).toContainText(
      'Senior Software Engineer, Applied AI',
    );
  });

  test('loads both locales with every feed thumbnail rendered and zero console errors: a thumbnail host the image allowlist rejects 400s in /_next/image and fails errors-in-console', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    const thumbnails = () =>
      page.locator('ol img').evaluateAll((images) => ({
        total: images.length,
        loaded: images.filter((img) => (img as HTMLImageElement).naturalWidth > 0).length,
      }));
    const heroThumbnailWidth = () =>
      page
        .locator('a[data-outbound="ultimo-video"] img')
        .evaluate((img) => (img as HTMLImageElement).naturalWidth);

    async function assertThumbnailsRendered() {
      await expect
        .poll(async () => (await thumbnails()).total, {
          message:
            'without history rows every decode assertion below is vacuous; zero here means the feed failed to render, not that the thumbnails loaded',
        })
        .toBeGreaterThan(0);

      const rows = page.locator('ol img');
      const total = await rows.count();
      for (let i = 0; i < total; i++) {
        await rows.nth(i).scrollIntoViewIfNeeded();
      }
      await expect
        .poll(thumbnails, {
          message:
            'VideoHistory images are lazy: networkidle alone does not load rows below the fold, so each row is scrolled into view to trigger its request. Every thumbnail must decode after scrolling. A partial regression (one shard host 400ing in /_next/image while another still loads) fails here instead of hiding behind the one image that worked.',
        })
        .toEqual({ total, loaded: total });

      await expect(
        page.locator('a[data-outbound="ultimo-video"]'),
        'the hero anchor only renders when the feed has a latest video; without this count check a missing feed surfaces as an opaque locator timeout inside the decode poll below',
      ).toHaveCount(1);
      await expect
        .poll(heroThumbnailWidth, {
          message:
            'the ChannelCard priority image is the page LCP element and sits outside the ol list; it needs its own decode assertion instead of relying on history[0] happening to share the thumbnail',
        })
        .toBeGreaterThan(0);
    }

    await page.goto('/links', { waitUntil: 'networkidle' });
    await assertThumbnailsRendered();
    await page.goto('/links/en', { waitUntil: 'networkidle' });
    await assertThumbnailsRendered();

    expect(
      consoleErrors,
      'every entry here is a Lighthouse errors-in-console failure: an image the optimizer rejected, a hydration error, a CSP block. None of these belong on a static page.',
    ).toEqual([]);
  });

  test('keeps every visible text element at or above the 12px mobile floor on both locales', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const path of ['/links', '/links/en']) {
      await page.goto(path);
      const offenders = await page.evaluate(() => {
        const floor = 12;
        const failures: string[] = [];
        for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
          const ownText = Array.from(el.childNodes)
            .filter((node): node is Text => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent)
            .join('')
            .trim();
          if (ownText === '') continue;
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          const box = el.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) continue;
          const size = Number.parseFloat(style.fontSize);
          if (size < floor) {
            failures.push(
              `<${el.tagName.toLowerCase()} class="${el.getAttribute('class')}"> ${size}px "${ownText.slice(0, 40)}"`,
            );
          }
        }
        return failures;
      });
      expect(
        offenders,
        `${path}: sub-12px text on mobile is the Lighthouse font-size audit failing and the --text-min token floor broken. Each offender lists its class, computed size and copy so the culprit utility is identifiable without a debugger.`,
      ).toEqual([]);
    }
  });
});

test('shows no next-video teaser or launch status once the channel has a latest video', async ({
  page,
}) => {
  await page.goto('/links');
  await expect(page.locator('a[data-outbound="ultimo-video"]')).toHaveCount(1);
  await expect(page.locator('.links-ticker-track')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/primeiros v\u00eddeos|em breve/);

  await page.goto('/links/en');
  await expect(page.locator('.links-ticker-track')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/first videos|\bsoon\b/);
});

const FONT_REQUEST = /\/_next\/static\/media\/([a-z_]+?)_?(\d+)?-s\./;
const DISPLAY_FACE = 'inter';
const MONO_FACE = 'jetbrains_mono';
const MONO_WEIGHTS = ['400', '700'];

async function fontFacesRequested(page: Page, path: string): Promise<string[]> {
  const faces: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() !== 'font') return;
    const match = FONT_REQUEST.exec(request.url());
    if (match) faces.push(`${match[1]}:${match[2] ?? ''}`);
  });
  await page.goto(path, { waitUntil: 'networkidle' });
  return faces;
}

test.describe('font payload', () => {
  for (const path of ['/links', '/links/en']) {
    test(`${path} downloads only the mono faces its text uses: the display face belongs to a visible h1 and a face no rule asks for is dead weight in the Lighthouse mobile LCP model`, async ({
      page,
    }) => {
      const faces = await fontFacesRequested(page, path);
      expect(faces.length, 'the page paints text, so at least one face loads').toBeGreaterThan(0);
      expect(
        faces.filter((face) => !face.startsWith(`${MONO_FACE}:`)),
        'the sr-only h1 must not pull the display face',
      ).toEqual([]);
      expect(
        faces
          .map((face) => face.split(':')[1] ?? '')
          .filter((weight) => !MONO_WEIGHTS.includes(weight)),
        'only the 400 and 700 mono faces are declared',
      ).toEqual([]);
    });
  }

  test('the homepage still loads the display face for its visible h1, so the guard above is not vacuous', async ({
    page,
  }) => {
    const faces = await fontFacesRequested(page, '/');
    expect(faces.some((face) => face.startsWith(`${DISPLAY_FACE}:`))).toBe(true);
  });
});

const LIGHTHOUSE_MOBILE_VIEWPORT = { width: 412, height: 823 };
const LCP_COVER_FIXTURE = 'tests/e2e/fixtures/thumb.jpg';
const LCP_OPTIMIZER_ROUTE = '**/_next/image**';

test.describe('largest contentful paint', () => {
  test.use({ viewport: LIGHTHOUSE_MOBILE_VIEWPORT });

  for (const path of ['/links', '/links/en']) {
    test(`${path} paints the latest-video cover last and largest at mobile width, so the LCP work targets the right element`, async ({
      page,
    }) => {
      await page.route(LCP_OPTIMIZER_ROUTE, (route) =>
        route.fulfill({ path: LCP_COVER_FIXTURE, contentType: 'image/jpeg' }),
      );
      await page.addInitScript(() => {
        const entries: string[] = [];
        Object.assign(window, { lcpElements: entries });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const element = (entry as PerformanceEntry & { element?: Element | null }).element;
            entries.push(
              element
                ? `${element.tagName}:${element.closest('.links-thumb') ? 'cover' : 'other'}`
                : 'none',
            );
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
      await page.goto(path, { waitUntil: 'networkidle' });
      const hasCover = (await page.locator('.links-thumb img').count()) > 0;
      test.skip(!hasCover, 'the channel feed has no latest video, so there is no cover to measure');
      const entries = await page.evaluate(
        () => (window as unknown as { lcpElements: string[] }).lcpElements,
      );
      expect(
        entries.at(-1),
        'the final LCP candidate is the cover image: it starts near the fold, so a viewport shorter than the Lighthouse mobile one leaves a strip smaller than the identity text block',
      ).toBe('IMG:cover');
    });
  }
});
