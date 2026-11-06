import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hydrateClient, type MountedClient } from '@/__tests__/helpers/render';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE } from '@/content/site-locale';
import { contactChrome } from '@/content/terminal-chrome';
import { ContactForm } from './ContactForm';
import { messageStore } from './messageStore';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const TYPED = { name: 'Ada Lovelace', email: 'ada@example.com', message: 'Typed before scripts.' };

function field(container: HTMLElement, selector: string) {
  return container.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
}

describe('ContactForm hydrating over markup the visitor already typed into', () => {
  let mounted: MountedClient;

  afterEach(() => {
    mounted?.unmount();
    messageStore.reset();
  });

  it('adopts the text in the server-rendered fields into its state', async () => {
    mounted = await hydrateClient(
      createElement(ContactForm, {
        copy: contactCopy[SITE_LOCALE.en],
        chrome: contactChrome[SITE_LOCALE.en],
      }),
      (container) => {
        field(container, 'input[name="name"]').value = TYPED.name;
        field(container, 'input[name="email"]').value = TYPED.email;
        field(container, 'textarea[name="message"]').value = TYPED.message;
      },
    );

    expect(field(mounted.container, 'input[name="name"]').value, 'name kept').toBe(TYPED.name);
    expect(field(mounted.container, 'input[name="email"]').value, 'email kept').toBe(TYPED.email);
    expect(
      messageStore.getSnapshot(),
      'the message typed before hydration is the controlled state, so a submit sends it',
    ).toBe(TYPED.message);
    expect(mounted.container.querySelector('.contact-count')?.textContent).toContain(
      `${TYPED.message.length}`,
    );
  });

  it('leaves empty fields empty', async () => {
    mounted = await hydrateClient(
      createElement(ContactForm, {
        copy: contactCopy[SITE_LOCALE.en],
        chrome: contactChrome[SITE_LOCALE.en],
      }),
      () => undefined,
    );

    expect(messageStore.getSnapshot()).toBe('');
    expect(field(mounted.container, 'input[name="name"]').value).toBe('');
  });
});
