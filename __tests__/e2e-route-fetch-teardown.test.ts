import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const E2E_DIR = path.join(process.cwd(), 'tests', 'e2e');
const FETCHING_HANDLER = /\broute\.fetch\(/;
const DRAINS_ROUTES = /\bdrainRoutes\(/;

test('every e2e spec whose route handler calls route.fetch drains its routes before teardown', () => {
  const offenders = readdirSync(E2E_DIR)
    .filter((file) => file.endsWith('.spec.ts'))
    // behavioral-test-allow: the property is a source-level teardown call in Playwright specs, which only run in a browser project and have no runtime behaviour to exercise here
    .filter((file) => FETCHING_HANDLER.test(readFileSync(path.join(E2E_DIR, file), 'utf8')))
    // behavioral-test-allow: same source-level teardown property as the line above
    .filter((file) => !DRAINS_ROUTES.test(readFileSync(path.join(E2E_DIR, file), 'utf8')));
  expect(
    offenders,
    'a route handler awaiting route.fetch() that is still in flight when the test ends rejects with "route.fetch: Test ended" and Playwright charges it to whichever test runs next in the worker, so an unrelated spec flakes. Call drainRoutes(page or context) from tests/e2e/_helpers/routes.ts in afterEach (or before closing the context).',
  ).toEqual([]);
});
