import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { type MountedClient, mountClient } from '@/__tests__/helpers/render';
import { contactCopy } from '@/content/contact-copy';
import { SITE_LOCALE } from '@/content/site-locale';
import { contactChrome } from '@/content/terminal-chrome';
import { ContactForm } from './ContactForm';

let mounted: MountedClient | undefined;

afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
});

describe.each(Object.values(SITE_LOCALE))(
  'ContactForm required-field instruction (%s)',
  (locale) => {
    it('tells the visitor, before the first field, that every field is required (WCAG 3.3.2)', async () => {
      const copy = contactCopy[locale];
      mounted = await mountClient(
        createElement(ContactForm, { copy, chrome: contactChrome[locale] }),
      );
      const form = mounted.container.querySelector('form') as HTMLFormElement;
      const note = [...form.querySelectorAll('p')].find(
        (paragraph) => paragraph.textContent === copy.form.requiredNote,
      );
      expect(note, 'the form states the requirement in visible text').toBeDefined();
      const fields = [...form.querySelectorAll<HTMLElement>('input[name], textarea')].filter(
        (field) => field.getAttribute('name') !== 'field_company',
      );
      expect(fields.length).toBe(3);
      for (const field of fields) {
        expect(field.hasAttribute('required'), `${field.getAttribute('name')} is required`).toBe(
          true,
        );
        expect(
          note && note.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING,
          `the instruction precedes ${field.getAttribute('name')}`,
        ).toBeTruthy();
      }
    });
  },
);
