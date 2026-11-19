import { expect, type Locator, type Page } from '@playwright/test';
import { openSectionMenu, waitForHydration } from './hydration';

export const CONTACT_FORM_SELECTOR = '[data-testid="contact-form"]';

const CONTACT_LINK_NAME = /contact/i;
const SEND_BUTTON_NAME = 'EXECUTE_SEND';
const CONTACT_ENDPOINT_SUFFIX = '/api/contact';
const POST_METHOD = 'POST';
const SEND_REACHED_ENDPOINT =
  'no POST reached /api/contact: the send click was dropped before the handler (click before commit)';

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

export function trackContactPosts(page: Page): () => number {
  let posts = 0;
  page.on('request', (request) => {
    if (request.method() === POST_METHOD && request.url().endsWith(CONTACT_ENDPOINT_SUFFIX)) {
      posts += 1;
    }
  });
  return () => posts;
}

export async function expectOneContactPost(posts: () => number): Promise<void> {
  await expect.poll(posts, { message: SEND_REACHED_ENDPOINT }).toBe(1);
}
