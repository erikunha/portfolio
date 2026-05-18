import { ContactFormLazy } from '../client/ContactFormLazy';
import { ErrorBoundary } from '../ErrorBoundary.client';
import { IconContact } from '../Icons';
import { Module } from '../responsive/Module';

export function ContactSection() {
  return (
    <Module
      id="sec-contact"
      header="SUDO CONTACT --INIT"
      mobileHeader="CONTACT"
      icon={<IconContact />}
    >
      <ErrorBoundary>
        <ContactFormLazy />
      </ErrorBoundary>
    </Module>
  );
}
