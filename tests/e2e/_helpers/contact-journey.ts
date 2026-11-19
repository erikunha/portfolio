import { expect, type Locator, type Page } from '@playwright/test';
import { openSectionMenu, waitForHydration } from './hydration';

export const CONTACT_FORM_SELECTOR = '[data-testid="contact-form"]';

const CONTACT_LINK_NAME = /contact/i;
const SEND_BUTTON_NAME = 'EXECUTE_SEND';

export const VISITOR = {
  name: 'Test Visitor',
  email: 'visitor@example.com',
  message: 'A message submitted through the real contact form.',
} as const;

export async function openContactFromMenu(page: Page): Promise<Locator> {
  await openSectionMenu(page);
  await page.getByRole('dialog').getByRole('link', { name: CONTACT_LINK_NAME }).first().click();
  const form = page.locator(CONTACT_FORM_SELECTOR);
  await expect(form).toBeVisible();
  return form;
}

export async function sendVisitorMessage(form: Locator): Promise<void> {
  await waitForHydration(form.page(), CONTACT_FORM_SELECTOR);
  await form.getByLabel('$ name:').fill(VISITOR.name);
  await form.getByLabel('$ email:').fill(VISITOR.email);
  await form.getByLabel('$ message:').fill(VISITOR.message);
  await form.getByRole('button', { name: SEND_BUTTON_NAME, exact: true }).click();
}
