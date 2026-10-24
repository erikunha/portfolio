import { expect, test } from '@playwright/test';
import { linksContent } from '../../content/links';
import { installMockBackend } from './_helpers/mock-backend';

for (const state of ['queued', 'happy'] as const) {
  test(`contact delivery: ${state}`, async ({ page }) => {
    await installMockBackend(page, { contact: state, log: 'accept' });
    await page.goto('/');
    await page
      .getByRole('link', { name: /contact/i })
      .filter({ visible: true })
      .first()
      .click();
    const form = page.getByTestId('contact-form');
    await expect(form).toBeVisible();
    await form.getByLabel('$ name:').fill('Test Visitor');
    await form.getByLabel('$ email:').fill('visitor@example.com');
    await form.getByLabel('$ message:').fill('A message submitted through the real contact form.');
    await form.getByRole('button', { name: 'EXECUTE_SEND', exact: true }).click();

    if (state === 'queued') {
      const queued = page.getByTestId('contact-queued');
      await expect(queued).toBeVisible();
      await expect(queued).toHaveAttribute('role', 'status');
      await expect(queued).toContainText('saved, not delivered yet');
      await expect(queued).toContainText('delivery is retried automatically');
      const linkedIn = queued.getByRole('link', { name: 'LinkedIn' });
      await expect(linkedIn).toHaveAttribute(
        'href',
        linksContent.pills.find((pill) => pill.id === 'linkedin')?.href ?? '',
      );
      await expect(page.getByTestId('contact-success')).toHaveCount(0);
    } else {
      await expect(page.getByTestId('contact-success')).toContainText('EXECUTE_SEND :: SUCCESS');
      await expect(page.getByTestId('contact-success')).toContainText(
        'handshake initiated · expect reply within 48h',
      );
      await expect(page.getByTestId('contact-queued')).toHaveCount(0);
    }
    await expect(form).toHaveCount(0);
  });
}
