import { gotoSettled } from './_helpers/streamed';
import { expect, test } from './_helpers/test';

const VITALS_ROUTE = '**/api/vitals';
const POLL_TIMEOUT_MS = 20_000;
const CHUNK_MARKER = 'interactionId';

interface VitalsPost {
  resourceType: string;
  contentType: string;
  body: { path: string; metrics: Record<string, unknown>[] };
}

test.describe('field vitals beacon', () => {
  test('sends first-party beacons with LCP attribution after an interaction, loading after LCP', async ({
    page,
  }) => {
    const posts: VitalsPost[] = [];
    await page.route(VITALS_ROUTE, async (route) => {
      const request = route.request();
      posts.push({
        resourceType: request.resourceType(),
        contentType: request.headers()['content-type'] ?? '',
        body: JSON.parse(request.postData() ?? '{}'),
      });
      await route.fulfill({ status: 200, json: { ok: true, requestId: 'e2e' } });
    });
    await page.addInitScript(() => {
      const win = window as unknown as { __lcp: { startTime: number }[] };
      win.__lcp = [];
      new PerformanceObserver((list) => {
        win.__lcp.push(...list.getEntries());
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });

    await gotoSettled(page, '/?utm_source=secret#frag');

    await expect
      .poll(
        async () => {
          await page.mouse.click(5, 5);
          await page.evaluate(() => {
            Object.defineProperty(document, 'visibilityState', {
              configurable: true,
              value: 'hidden',
            });
            document.dispatchEvent(new Event('visibilitychange'));
            Object.defineProperty(document, 'visibilityState', {
              configurable: true,
              value: 'visible',
            });
          });
          return posts.some((post) => post.body.metrics.some((metric) => metric.name === 'LCP'));
        },
        { timeout: POLL_TIMEOUT_MS },
      )
      .toBe(true);

    for (const post of posts) {
      expect(post.resourceType).toBe('ping');
      expect(post.contentType).toContain('application/json');
      expect(post.body.path).toBe('/');
      expect(JSON.stringify(post.body)).not.toMatch(/utm|secret|frag/);
    }
    const lcp = posts.flatMap((post) => post.body.metrics).find((metric) => metric.name === 'LCP');
    expect(lcp).toMatchObject({
      value: expect.any(Number),
      ttfb: expect.any(Number),
      loadDelay: expect.any(Number),
      loadDuration: expect.any(Number),
      renderDelay: expect.any(Number),
      tag: expect.stringMatching(/^[a-z][a-z0-9]*$/),
    });

    const timing = await page.evaluate(async (marker) => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const lcpEntries = (window as unknown as { __lcp: { startTime: number }[] }).__lcp;
      const lastLcpStart = Math.max(...lcpEntries.map((entry) => entry.startTime));
      const late = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter(
        (entry) => entry.initiatorType === 'script' && entry.startTime >= nav.loadEventEnd,
      );
      const chunkStarts: number[] = [];
      for (const entry of late) {
        const text = await (await fetch(entry.name)).text();
        if (text.includes(marker)) chunkStarts.push(entry.startTime);
      }
      return { loadEventEnd: nav.loadEventEnd, lastLcpStart, chunkStarts };
    }, CHUNK_MARKER);

    expect(timing.chunkStarts.length).toBeGreaterThan(0);
    for (const start of timing.chunkStarts) {
      expect(start).toBeGreaterThanOrEqual(timing.loadEventEnd);
      expect(start).toBeGreaterThan(timing.lastLcpStart);
    }
  });

  test('sends nothing while the page stays visible', async ({ page }) => {
    const posts: string[] = [];
    await page.route(VITALS_ROUTE, (route) => {
      posts.push(route.request().url());
      return route.fulfill({ status: 200, json: { ok: true } });
    });

    await gotoSettled(page, '/');
    await page.mouse.click(5, 5);
    await page.evaluate(
      () => new Promise<void>((resolve) => requestIdleCallback(() => resolve(), { timeout: 5000 })),
    );

    expect(posts).toHaveLength(0);
  });
});
