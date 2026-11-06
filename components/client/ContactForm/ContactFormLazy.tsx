'use client';

import { lazy } from 'react';
import type { ContactContent } from '@/content/contact';
import type { TerminalChrome } from '@/content/schemas';
import { LazyIsland } from '../LazyIsland';

export type ContactFormProps = {
  copy: ContactContent;
  chrome: TerminalChrome;
  loadingLabel: string;
};

export const CONTACT_FORM_MIN_HEIGHT = 'calc(5 * var(--spacing-target))';

const FormComponent = lazy(() => import('./ContactForm').then((m) => ({ default: m.ContactForm })));

export function ContactFormLazy({ loadingLabel, ...props }: ContactFormProps) {
  return (
    <LazyIsland
      minHeight={CONTACT_FORM_MIN_HEIGHT}
      loading={<div className="contact" role="status" aria-busy="true" aria-label={loadingLabel} />}
    >
      <FormComponent {...props} />
    </LazyIsland>
  );
}
