import { linksContent } from '../../content/links';
import {
  expectOneContactPost,
  openContactFromMenu,
  sendVisitorMessage,
  trackContactPosts,
} from './_helpers/contact-journey';
import { installMockBackend } from './_helpers/mock-backend';
import { expect, test } from './_helpers/test';

for (const state of ['queued', 'happy'] as const) {
  test(`contact delivery: ${state}`, { tag: '@cross-browser' }, async ({ page }) => {
    await installMockBackend(page, { contact: state, log: 'accept' });
    const posts = trackContactPosts(page);
    await page.goto('/');
    const form = await openContactFromMenu(page);
    await sendVisitorMessage(form);
    await expectOneContactPost(posts);

    if (state === 'queued') {
      const queued = page.getByTestId('contact-queued');
      await expect(queued).toBeVisible();
      await expect(queued).toHaveAttribute('role', 'status');
      await expect(queued).toContainText('~ saved, delivery pending');
      await expect(queued).toContainText('retried once a day, up to 3 times');
      await expect(queued).not.toContainText('contact-test-request-id');
      const linkedIn = queued.getByRole('link', { name: /message on LinkedIn/ });
      await expect(linkedIn).toHaveAttribute(
        'href',
        linksContent.pills.find((pill) => pill.id === 'linkedin')?.href ?? '',
      );
      await expect(page.getByTestId('contact-success')).toHaveCount(0);
    } else {
      await expect(page.getByTestId('contact-success')).toContainText('✓ message delivered');
      await expect(page.getByTestId('contact-success')).toContainText('Reply within 48h');
      await expect(page.getByTestId('contact-queued')).toHaveCount(0);
    }
    await expect(form).toHaveCount(0);
    expect(posts(), 'the journey sends exactly one message').toBe(1);
  });
}
