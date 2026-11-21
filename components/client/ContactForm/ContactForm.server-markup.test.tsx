import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE } from '@/content/site-locale';
import { contactChrome } from '@/content/terminal-chrome';
import { ContactForm } from './ContactForm';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

function serverForm() {
  const html = renderToString(
    createElement(ContactForm, {
      copy: contactCopy[SITE_LOCALE.en],
      chrome: contactChrome[SITE_LOCALE.en],
    }),
  );
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.querySelector('form.contact-form') as HTMLFormElement;
}

describe('ContactForm server markup before hydration', () => {
  it('posts to a javascript: action so a native submit never puts the fields in the URL', () => {
    const form = serverForm();

    expect(form.getAttribute('action') ?? '').toMatch(/^javascript:/);
  });

  it('sets no method that would send the fields natively', () => {
    const form = serverForm();

    expect(form.hasAttribute('method')).toBe(false);
    expect(form.getAttribute('formmethod')).toBeNull();
  });
});
