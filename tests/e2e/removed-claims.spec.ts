import { expect, test } from '@playwright/test';
import { RENDERED_ROUTES, RETIRED_CLAIMS } from '../../__tests__/helpers/retired-claims';

test.describe('retired claims stay out of every rendered route', () => {
  for (const route of RENDERED_ROUTES) {
    test(`${route} serves none of the retired claims`, async ({ request }) => {
      const response = await request.get(route);
      expect(response.status(), `${route} must render`).toBe(200);
      const body = await response.text();
      for (const { name, pattern, reason } of RETIRED_CLAIMS) {
        expect(body, `${route}: ${name}. ${reason}`).not.toMatch(pattern);
      }
    });
  }
});
