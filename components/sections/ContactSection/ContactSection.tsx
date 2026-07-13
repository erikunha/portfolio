import { SECTION_LABELS } from '@/content/section-labels';
import { ContactFormLazy } from '../../client/ContactForm';
import { ErrorBoundary } from '../../ErrorBoundary';
import { IconContact } from '../../Icons';
import { Module } from '../../responsive/Module';

export function ContactSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-contact"
      header="SUDO CONTACT --INIT"
      mobileHeader="CONTACT"
      srLabel={SECTION_LABELS['sec-contact']}
      icon={<IconContact />}
      defer={defer}
      variant="green"
    >
      <ErrorBoundary>
        <ContactFormLazy />
      </ErrorBoundary>
    </Module>
  );
}
