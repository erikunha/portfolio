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
      icon={<IconContact />}
      defer={defer}
    >
      <ErrorBoundary>
        <ContactFormLazy />
      </ErrorBoundary>
    </Module>
  );
}
