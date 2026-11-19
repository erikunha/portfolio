import type { Page } from '@playwright/test';

const SCRIPT_CHUNKS = '**/_next/static/**/*.js';

export async function holdChunk(
  page: Page,
  marker: string,
  hold: () => Promise<unknown>,
): Promise<() => number> {
  let held = 0;
  await page.route(SCRIPT_CHUNKS, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (body.includes(marker)) {
      held += 1;
      await hold();
    }
    await route.fulfill({ response, body });
  });
  return () => held;
}
