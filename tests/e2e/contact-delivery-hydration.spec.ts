import { setTimeout as delay } from 'node:timers/promises';
import { expect, test } from '@playwright/test';
import {
  CONTACT_FORM_SELECTOR,
  openContactFromMenu,
  sendVisitorMessage,
} from './_helpers/contact-journey';
import { installMockBackend } from './_helpers/mock-backend';
import { installCommitOracle, isNodeCommitted } from './_helpers/react-commit-oracle';
import { drainRoutes } from './_helpers/routes';

const FORM_CHUNK_MARKER = 'contact-form';
const FORM_CHUNK_HOLD_MS = 3_000;
const CONTACT_ENDPOINT_SUFFIX = '/api/contact';

test.describe('the contact journey acts on the form only once React committed it', () => {
  test.afterEach(({ page }) => drainRoutes(page));

  test('a form chunk that arrives late does not swallow the send click', async ({ page }) => {
    await installCommitOracle(page);
    let heldChunks = 0;
    await page.route('**/_next/static/**/*.js', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes(FORM_CHUNK_MARKER)) {
        heldChunks += 1;
        await delay(FORM_CHUNK_HOLD_MS);
      }
      await route.fulfill({ response, body });
    });
    let posts = 0;
    page.on('request', (request) => {
      if (request.url().endsWith(CONTACT_ENDPOINT_SUFFIX)) posts += 1;
    });
    await installMockBackend(page, { contact: 'happy', log: 'accept' });
    await page.goto('/');

    const form = await openContactFromMenu(page);
    expect(
      await isNodeCommitted(page, CONTACT_FORM_SELECTOR),
      'the journey helper returned while the server-rendered form had no handlers yet',
    ).toBe(true);
    await sendVisitorMessage(form);

    await expect(page.getByTestId('contact-success')).toContainText('✓ message delivered');
    expect(heldChunks, 'no chunk carried the form, so nothing was held').toBeGreaterThan(0);
    expect(posts, 'one send click reaches the endpoint once').toBe(1);
  });
});
