import { expect, test } from './_helpers/test';

const RULES_PATH = '/speculation-rules.json';
const RULES_CONTENT_TYPE = 'application/speculationrules+json';
const PREFETCH_PURPOSE = 'prefetch';
const PREFETCH_DELIVERY = 'navigational-prefetch';
const HOVER_SETTLE_MS = 900;
const PREFETCH_TIMEOUT_MS = 10_000;
const PROBE_CONTAINER_ID = 'speculation-probes';
const PAGE_ROUTES = ['/', '/cv', '/pt/cv', '/links/en', '/design-system'];

interface Probe {
  name: string;
  href: string;
  attributes: Record<string, string>;
}

const ELIGIBLE_PROBE: Probe = { name: 'eligible', href: '/summary', attributes: {} };

const EXCLUDED_PROBES: Probe[] = [
  { name: 'api', href: '/api/healthz', attributes: {} },
  { name: 'pdf', href: '/erik-cunha-cv.pdf', attributes: {} },
  { name: 'query', href: '/probe-query?retry=1', attributes: {} },
  { name: 'new-tab', href: '/probe-new-tab', attributes: { target: '_blank' } },
  { name: 'nofollow', href: '/probe-nofollow', attributes: { rel: 'nofollow' } },
  { name: 'download', href: '/probe-download', attributes: { download: '' } },
  { name: 'external', href: 'https://example.org/page', attributes: {} },
];

test.describe('speculation rules', () => {
  test('every page route points at the rules file and the API does not', async ({ request }) => {
    for (const path of PAGE_ROUTES) {
      const response = await request.get(path);
      expect(response.headers()['speculation-rules'], path).toBe(`"${RULES_PATH}"`);
    }
    const api = await request.get('/api/healthz');
    expect(api.headers()['speculation-rules']).toBeUndefined();
    const pdf = await request.get('/erik-cunha-cv.pdf');
    expect(pdf.headers()['speculation-rules']).toBeUndefined();
  });

  test('the rules file is served as speculationrules+json and parses', async ({ request }) => {
    const response = await request.get(RULES_PATH);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe(RULES_CONTENT_TYPE);
    const rules = JSON.parse(await response.text());
    expect(Object.keys(rules)).toEqual(['prefetch']);
  });

  test('hovering an internal link prefetches it and the click is served from it', async ({
    page,
  }) => {
    const prefetched: string[] = [];
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    cdp.on('Network.requestWillBeSent', ({ request }) => {
      const purpose = request.headers['Sec-Purpose'] ?? request.headers['sec-purpose'];
      if (purpose?.startsWith(PREFETCH_PURPOSE)) prefetched.push(new URL(request.url).pathname);
    });

    await page.goto('/');
    const link = page.locator('a[href="/cv"]:visible').first();
    await link.hover();
    await expect.poll(() => prefetched, { timeout: PREFETCH_TIMEOUT_MS }).toContain('/cv');

    await link.click();
    await page.waitForURL('**/cv');
    await page.waitForLoadState('load');
    const delivery = await page.evaluate(
      () =>
        (performance.getEntriesByType('navigation')[0] as { deliveryType?: string }).deliveryType,
    );
    expect(delivery).toBe(PREFETCH_DELIVERY);
  });

  test('links the rules exclude are never prefetched', async ({ page }) => {
    const prefetched: string[] = [];
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    cdp.on('Network.requestWillBeSent', ({ request }) => {
      const purpose = request.headers['Sec-Purpose'] ?? request.headers['sec-purpose'];
      if (purpose?.startsWith(PREFETCH_PURPOSE)) prefetched.push(request.url);
    });

    await page.goto('/');
    await page.evaluate(
      ({ probes, containerId }) => {
        const container = document.createElement('div');
        container.id = containerId;
        container.style.cssText =
          'position:fixed;top:0;left:0;z-index:2147483647;background:#000;padding:8px;display:flex;flex-direction:column;gap:8px';
        for (const probe of probes) {
          const anchor = document.createElement('a');
          anchor.href = probe.href;
          anchor.textContent = probe.name;
          anchor.dataset.probe = probe.name;
          for (const [name, value] of Object.entries(probe.attributes)) {
            anchor.setAttribute(name, value);
          }
          container.append(anchor);
        }
        document.body.append(container);
      },
      { probes: [ELIGIBLE_PROBE, ...EXCLUDED_PROBES], containerId: PROBE_CONTAINER_ID },
    );

    for (const probe of EXCLUDED_PROBES) {
      await page.locator(`a[data-probe="${probe.name}"]`).hover();
      await page.waitForTimeout(HOVER_SETTLE_MS);
    }
    expect(prefetched, 'an excluded link was prefetched').toEqual([]);

    await page.locator(`a[data-probe="${ELIGIBLE_PROBE.name}"]`).hover();
    await expect
      .poll(() => prefetched.map((url) => new URL(url).pathname), {
        timeout: PREFETCH_TIMEOUT_MS,
      })
      .toEqual([ELIGIBLE_PROBE.href]);
  });
});
