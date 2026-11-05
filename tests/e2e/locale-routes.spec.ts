import { expect, test } from '@playwright/test';

// Address-based locales (DECISIONS 2026-08-30/2026-11-04): the bare address
// serves English and never redirects; pt-BR lives under /pt. Each language
// names itself canonical, alternates join the pair, and the switch is a link
// carrying aria-current, never a toggle.
const PAIRS = [
  { en: '/', pt: '/pt', enTitle: /Erik Cunha/ },
  { en: '/cv', pt: '/pt/cv', enTitle: /CV · Erik Cunha/ },
  { en: '/summary', pt: '/pt/summary', enTitle: /30s summary · Erik Cunha/ },
];

const WIDTHS = [
  { width: 320, height: 720 },
  { width: 1280, height: 800 },
];

// Next normalizes the root canonical to the origin with no trailing slash.
const absolute = (path: string) => `https://www.erikunha.dev${path === '/' ? '' : path}`;

for (const { en, pt, enTitle } of PAIRS) {
  for (const viewport of WIDTHS) {
    test(`${en} at ${viewport.width} renders English with its own canonical`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const response = await page.goto(en);
      expect(response?.status(), 'the bare address must return a page, never a redirect').toBe(200);
      expect(response?.headers().location ?? null).toBeNull();
      await expect(page).toHaveTitle(enTitle);

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveAttribute('href', absolute(en));

      const langAttr =
        en === '/' ? await page.evaluate(() => document.documentElement.lang) : 'en-US';
      if (en === '/') expect(langAttr).toBe('en');
    });

    test(`${pt} at ${viewport.width} renders pt-BR with lang, canonical and alternates`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const response = await page.goto(pt);
      expect(response?.status()).toBe(200);

      // the pt subtree declares its language on the wrapper (root html stays
      // en-US, the same shape /links ships)
      const lang = await page.evaluate(() => {
        const wrapper = document.querySelector('[lang="pt-BR"]');
        return wrapper?.getAttribute('lang') ?? document.documentElement.lang;
      });
      expect(lang).toBe('pt-BR');

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveAttribute('href', `https://www.erikunha.dev${pt}`);

      const alternate = page.locator('link[rel="alternate"][hreflang="en-US"]');
      await expect(alternate).toHaveAttribute('href', absolute(en));
      const xDefault = page.locator('link[rel="alternate"][hreflang="x-default"]');
      await expect(xDefault).toHaveAttribute('href', absolute(en));
      const ptAlternate = page.locator('link[rel="alternate"][hreflang="pt-BR"]');
      await expect(ptAlternate).toHaveAttribute('href', `https://www.erikunha.dev${pt}`);
    });
  }

  test(`the language switch on ${en} links to ${pt} with aria-current`, async ({ page }) => {
    await page.goto(en);
    const switch_nav = page
      .locator('nav[aria-label="Language"], nav[aria-label="Idioma"]')
      .locator('visible=true');
    await expect(switch_nav).toHaveCount(1);
    const current = switch_nav.locator('a[aria-current="page"]');
    await expect(current).toHaveAttribute('href', en);

    const target = switch_nav.locator(`a[href="${pt}"]`);
    await expect(target).toHaveCount(1);
  });

  test(`the language switch on ${pt} links back to ${en} with aria-current`, async ({ page }) => {
    await page.goto(pt);
    const switch_nav = page
      .locator('nav[aria-label="Idioma"], nav[aria-label="Language"]')
      .locator('visible=true');
    await expect(switch_nav).toHaveCount(1);
    const current = switch_nav.locator('a[aria-current="page"]');
    await expect(current).toHaveAttribute('href', pt);
    const target = switch_nav.locator(`a[href="${en}"]`);
    await expect(target).toHaveCount(1);
  });
}

test('/pt hero renders Portuguese copy', async ({ page }) => {
  await page.goto('/pt');
  await expect(page.locator('[data-testid="hero-desktop"] [data-testid="hero-name"]')).toHaveText(
    'Erik Cunha',
  );
  const context = page.locator('[data-testid="hero-desktop"] .hero-context');
  await expect(context).toContainText('LOCAL:');
  await expect(context).toContainText('disponível agora');
  await expect(context).toContainText('fintech de mercados privados');
});

test('/pt links to the pt CV and summary from the hero actions', async ({ page }) => {
  await page.goto('/pt');
  // two layout variants render the actions; the desktop tree is the assertion target
  const ctas = page.locator('[data-testid="hero-desktop"] [data-testid="hero-ctas"]');
  await expect(ctas.locator('a[href="/pt/cv"]')).toHaveCount(1);
  await expect(ctas.locator('a[href="/pt/summary"]')).toHaveCount(1);
});

test('/pt chrome controls speak pt-BR', async ({ page }) => {
  await page.goto('/pt');
  await expect(page.getByRole('navigation', { name: 'Navegação do site' })).toBeVisible();
  // hidden until scroll on this viewport; the i18n contract is the attribute
  await expect(page.locator('.to-top-btn')).toHaveAttribute('aria-label', 'Voltar ao topo');
});
