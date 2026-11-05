'use client';

import { lazy, Suspense } from 'react';
import type { ContactContent } from '@/content/contact';
import type { TerminalChrome } from '@/content/schemas';

export type ContactFormProps = {
  copy: ContactContent;
  chrome: TerminalChrome;
  loadingLabel: string;
};

const FormComponent = lazy(() => import('./ContactForm').then((m) => ({ default: m.ContactForm })));

export function ContactFormLazy({ loadingLabel, ...props }: ContactFormProps) {
  return (
    <Suspense
      fallback={
        <div className="contact" role="status" aria-busy="true" aria-label={loadingLabel} />
      }
    >
      <FormComponent {...props} />
    </Suspense>
  );
}
