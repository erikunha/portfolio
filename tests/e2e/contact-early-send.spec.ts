import { expect, test } from '@playwright/test';
import {
  CONTACT_FORM_SELECTOR,
  clickSend,
  expectOneContactPost,
  fillVisitorMessage,
  holdContactFormChunk,
  openContactFromMenu,
  trackContactPosts,
  VISITOR,
} from './_helpers/contact-journey';
import { installMockBackend } from './_helpers/mock-backend';
import { installCommitOracle, isNodeCommitted } from './_helpers/react-commit-oracle';
import { drainRoutes } from './_helpers/routes';

const FORM_CHUNK_HOLD_MS = 5_000;
const SENT_AFTER_COMMIT_TIMEOUT_MS = 15_000;
const DELIVERED_TITLE = '✓ message delivered';
const SUCCESS_TEST_ID = 'contact-success';

test.describe('a send click before the contact form commits is not lost', () => {
  test.afterEach(({ page }) => drainRoutes(page));

  test('one click while the form chunk is held sends once and reaches the success state', {
    tag: '@cross-browser',
  }, async ({ page }) => {
    await installCommitOracle(page);
    const heldChunks = await holdContactFormChunk(page, FORM_CHUNK_HOLD_MS);
    let sent: Record<string, string> | null = null;
    page.on('request', (request) => {
      if (request.url().endsWith('/api/contact') && request.method() === 'POST') {
        sent = request.postDataJSON();
      }
    });
    const posts = trackContactPosts(page);
    await installMockBackend(page, { contact: 'happy', log: 'accept' });
    await page.goto('/');

    const form = await openContactFromMenu(page);
    await expect(form).toBeVisible();
    await fillVisitorMessage(form);
    expect(
      await isNodeCommitted(page, CONTACT_FORM_SELECTOR),
      'the hold ended before the click: the form was already committed, so this run proves nothing',
    ).toBe(false);
    await clickSend(form);

    await expectOneContactPost(posts, SENT_AFTER_COMMIT_TIMEOUT_MS);
    await expect(page.getByTestId(SUCCESS_TEST_ID)).toContainText(DELIVERED_TITLE, {
      timeout: SENT_AFTER_COMMIT_TIMEOUT_MS,
    });
    expect(heldChunks(), 'no chunk carried the form, so nothing was held').toBeGreaterThan(0);
    expect(posts(), 'the replayed click sends exactly once').toBe(1);
    expect(sent, 'the replayed send carries the typed fields').toMatchObject({
      name: VISITOR.name,
      email: VISITOR.email,
      message: VISITOR.message,
    });
  });
});
