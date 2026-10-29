import { expect, test } from '@playwright/test';

test.describe('/links link-in-bio', () => {
  test('the language switch is real routing, not a client-side toggle', async ({ page }) => {
    await page.goto('/links');
    await expect(page.locator('h1')).toHaveText(/links, canal e contato/);

    await page.getByRole('link', { name: 'English' }).click();
    await page.waitForURL('**/links/en');
    await expect(page.locator('h1')).toHaveText(/links, channel and contact/);

    await page.getByRole('link', { name: 'Português' }).click();
    await page.waitForURL(/\/links$/);
  });

  test('marks the active language for assistive tech', async ({ page }) => {
    await page.goto('/links/en');
    await expect(page.getByRole('link', { name: 'English' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('link', { name: 'Português' })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('declares the document language of each route to screen readers', async ({ page }) => {
    await page.goto('/links');
    await expect(page.locator('[lang="pt-BR"]').first()).toBeVisible();

    await page.goto('/links/en');
    await expect(page.locator('[lang="en-US"]').first()).toBeVisible();
  });

  test('serves a scannable QR from the server with no client-side canvas work', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/links');
    const qr = page.getByRole('img', { name: /QR code/ });
    await expect(qr).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  test('drops the QR panel on a phone, where the visitor is already holding the page', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/links');
    await expect(page.getByRole('img', { name: /QR code/ })).toBeHidden();
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
    await page.goto('/links');
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
    await page.goto('/links');
    const targets = page.locator(
      'nav a:visible, footer li a:visible, footer li button:visible, [data-outbound="inscrever"]:visible',
    );
    const count = await targets.count();
    expect(count).toBeGreaterThan(5);

    for (let i = 0; i < count; i++) {
      const box = await targets.nth(i).boundingBox();
      expect(
        box?.height ?? 0,
        `standalone tap target ${i} is under 44px. This selector deliberately covers the nav, footer pills and the subscribe CTA only: a link sitting inline inside a sentence is exempt from target-size minimums, so widening this to every anchor would fail on the footer's inline erikunha.dev link for no accessibility gain.`,
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
    const title = 'Engenheiro de Software Sênior, Frontend e Produto';
    const identity = page.locator('.links-identity-box');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/links');
    await expect(identity).toContainText(title);
    const first = await identity.textContent();
    await page.waitForTimeout(600);
    expect(await identity.textContent(), 'reduced motion must not type').toBe(first);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.reload();
    const samples = new Set<string | null>();
    for (let i = 0; i < 6; i++) {
      samples.add(await identity.textContent());
      await page.waitForTimeout(150);
    }
    expect(samples.size, 'the tagline must type when motion is allowed').toBeGreaterThan(1);
  });

  test('renders the English title on the English route', async ({ page }) => {
    await page.goto('/links/en');
    await expect(page.locator('.links-identity-box')).toContainText(
      'Senior Software Engineer, Frontend & Product',
    );
  });

  test('lays the social pills out in one column on mobile, two from 768px and three from 900px', async ({
    page,
  }) => {
    const columns = () =>
      page
        .locator('footer ul')
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/links');
    expect(await columns()).toBe(1);

    await page.setViewportSize({ width: 800, height: 800 });
    expect(await columns()).toBe(2);

    await page.setViewportSize({ width: 1000, height: 800 });
    expect(await columns()).toBe(3);
  });
});
