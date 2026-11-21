import { expect, test } from '@playwright/test';
import { holdChunk } from './_helpers/chunk-gate';
import { trapFiberWrite } from './_helpers/fiber-write-trap';
import { waitForHydration } from './_helpers/hydration';
import { installCommitOracle, isNodeCommitted } from './_helpers/react-commit-oracle';
import { drainRoutes } from './_helpers/routes';

const ISLANDS = [
  {
    name: 'contact form',
    selector: '[data-testid="contact-form"]',
    chunkMarker: 'contact-form',
  },
  {
    name: 'interactive shell',
    selector: '[data-testid="shell-form"]',
    chunkMarker: 'shell-form',
  },
] as const;

test.describe('waitForHydration returns only once React committed the island', () => {
  test.afterEach(({ page }) => drainRoutes(page));

  for (const island of ISLANDS) {
    test(`the ${island.name} wait is false at every write of React's fiber key`, async ({
      page,
    }) => {
      await installCommitOracle(page);
      const gate = Promise.withResolvers<void>();
      const heldChunks = await holdChunk(page, island.chunkMarker, () => gate.promise);
      try {
        await page.goto('/');
        await page.locator(island.selector).scrollIntoViewIfNeeded();
        expect(
          await isNodeCommitted(page, island.selector),
          'the island committed before its chunk was released, so the run proves nothing',
        ).toBe(false);
        const readSamples = await trapFiberWrite(page, island.selector);
        gate.resolve();
        await waitForHydration(page, island.selector);
        const samples = await readSamples();
        expect(heldChunks(), 'no chunk carried the island, so nothing was held').toBeGreaterThan(0);
        expect(
          samples.length,
          'React never wrote its fiber key on the server node: it replaced the node, so the trap saw nothing',
        ).toBeGreaterThan(0);
        expect(
          samples.flatMap((sample) => (sample.error ? [sample.error] : [])),
          'the predicate or the oracle threw inside the trap',
        ).toEqual([]);
        expect(
          samples.filter((sample) => sample.oracle),
          'React wrote the key on a node already committed: the trap sampled too late',
        ).toEqual([]);
        expect(
          samples.filter((sample) => sample.helper),
          'the hydration predicate said committed while React had only started rendering the node',
        ).toEqual([]);
        expect(
          await isNodeCommitted(page, island.selector),
          'the wait returned before React committed the island',
        ).toBe(true);
      } finally {
        gate.resolve();
      }
    });
  }
});
