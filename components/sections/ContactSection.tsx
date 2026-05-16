import { ContactForm } from '../client/ContactForm';
import { ErrorBoundary } from '../ErrorBoundary.client';
import { IconContact } from '../Icons';
import { Module } from '../responsive/Module';

export function ContactSection() {
  return (
    <Module id="sec-contact" header="SUDO CONTACT --INIT" icon={<IconContact />}>
      <ErrorBoundary>
        <ContactForm />
      </ErrorBoundary>
    </Module>
  );
}
