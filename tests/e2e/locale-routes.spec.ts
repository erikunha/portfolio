import { expect, test } from '@playwright/test';
import { SITE_HTML_LANG, SITE_LOCALE } from '@/content/site-locale';

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
      expect(response?.request().redirectedFrom() ?? null).toBeNull();
      await expect(page).toHaveTitle(enTitle);
      await expect(page.locator('html')).toHaveAttribute('lang', SITE_HTML_LANG[SITE_LOCALE.en]);
      await expect(page.locator('[lang="pt-BR"]')).toHaveCount(0);

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveAttribute('href', absolute(en));
    });

    test(`${pt} at ${viewport.width} renders pt-BR with lang, canonical and alternates`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const response = await page.goto(pt);
      expect(response?.status()).toBe(200);

      expect(response?.request().redirectedFrom() ?? null).toBeNull();
      await expect(page.locator('html')).toHaveAttribute('lang', SITE_HTML_LANG[SITE_LOCALE.pt]);
      await expect(page.locator('#main-content')).toHaveCount(1);

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

test.describe('a Portuguese browser asking for the bare address', () => {
  const PT_BR_ACCEPT_LANGUAGE = 'pt-BR,pt;q=0.9';
  test.use({ extraHTTPHeaders: { 'Accept-Language': PT_BR_ACCEPT_LANGUAGE } });

  for (const { en, enTitle } of PAIRS) {
    test(`${en} stays English with no redirect`, async ({ page }) => {
      const response = await page.goto(en);
      expect(response?.status()).toBe(200);
      expect(response?.request().redirectedFrom()).toBeNull();
      expect(new URL(page.url()).pathname).toBe(en);
      await expect(page.locator('html')).toHaveAttribute('lang', SITE_HTML_LANG[SITE_LOCALE.en]);
      await expect(page).toHaveTitle(enTitle);
    });
  }
});

test('/pt hero renders Portuguese copy', async ({ page }) => {
  await page.goto('/pt');
  await expect(page.locator('[data-testid="hero-desktop"] [data-testid="hero-name"]')).toHaveText(
    'Erik Cunha',
  );
  const context = page.locator('[data-testid="hero-desktop"] .hero-context');
  await expect(context).toContainText('LOCAL:');
  await expect(context).toContainText('disponível agora');
  await expect(context).toContainText('originação de negócios com IA');
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

test('an unknown /pt address answers 404 in Portuguese', async ({ page }) => {
  const response = await page.goto('/pt/pagina-que-nao-existe');
  expect(response?.status()).toBe(404);
  await expect(page.locator('html')).toHaveAttribute('lang', SITE_HTML_LANG[SITE_LOCALE.pt]);
  await expect(page.locator('#main-content')).toHaveCount(1);
  await expect(page.getByText('[ NÃO ENCONTRADO ]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ir para o início' })).toHaveAttribute('href', '/pt');
});

test('an unknown English address answers 404 in English', async ({ page }) => {
  const response = await page.goto('/page-that-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByText('[ NOT FOUND ]')).toBeVisible();
});
