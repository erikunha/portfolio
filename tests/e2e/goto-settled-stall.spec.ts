import { drainRoutes } from './_helpers/routes';
import { gotoSettled } from './_helpers/streamed';
import { type BrowserContext, expect, test } from './_helpers/test';

const STALLED_PATH = '/never-answers.js';
const STALLED_QUERY = '?token=must-not-reach-the-log';
const STALL_NAVIGATION_TIMEOUT_MS = 1_500;
const HEAD_OPEN_TAG = /<head[^>]*>/;

async function blockParserOnStalledScript(context: BrowserContext): Promise<() => void> {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route('**/*', async (route) => {
    const request = route.request();
    if (new URL(request.url()).pathname === STALLED_PATH) {
      await released;
      await route.abort();
      return;
    }
    if (request.resourceType() !== 'document') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body = (await response.text()).replace(
      HEAD_OPEN_TAG,
      (head) => `${head}<script src="${STALLED_PATH}${STALLED_QUERY}"></script>`,
    );
    await route.fulfill({ response, body });
  });
  return release;
}

test.describe('a navigation that stalls on a subresource', { tag: '@cross-browser' }, () => {
  let release: () => void = () => undefined;

  test.afterEach(async ({ context }) => {
    release();
    await drainRoutes(context);
  });

  test('gotoSettled fails with the requests still pending, keeping the timeout as the cause', async ({
    context,
    page,
  }) => {
    release = await blockParserOnStalledScript(context);

    const failure = await gotoSettled(page, '/', { timeout: STALL_NAVIGATION_TIMEOUT_MS }).then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(
      failure,
      'a parser blocked on a script that never answers must fail the navigation',
    ).toBeInstanceOf(Error);
    const error = failure as Error;
    expect(error.message).toContain(`${STALL_NAVIGATION_TIMEOUT_MS} ms`);
    expect(
      error.message,
      'the error must name the request that never answered, its resource type and that no response arrived',
    ).toContain(`${STALLED_PATH} (script, no response)`);
    expect(
      error.message,
      'the query string can carry a token: only the path may reach the CI log',
    ).not.toContain('must-not-reach-the-log');
    expect(error.cause, 'the original timeout stays reachable').toBeInstanceOf(Error);
    expect((error.cause as Error).name).toBe('TimeoutError');
  });
});
