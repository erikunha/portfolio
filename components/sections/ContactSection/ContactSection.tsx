import { contactContent, contactLanguageLine } from '@/content/contact';
import { SECTION_LABELS } from '@/content/section-labels';
import { ContactFormLazy } from '../../client/ContactForm';
import { ContactCopyButton } from '../../client/ContactForm/ContactCopyButton.client';
import { ErrorBoundary } from '../../ErrorBoundary';
import { IconContact } from '../../Icons';
import { Module } from '../../responsive/Module';

export function ContactSection({ defer }: { defer?: boolean } = {}) {
  const { section } = contactContent;
  return (
    <Module
      id="sec-contact"
      header={section.command}
      mobileHeader={section.mobileCommand}
      name={SECTION_LABELS['sec-contact']}
      icon={<IconContact />}
      defer={defer}
      variant="green"
    >
      <div className="contact-layout">
        <div className="contact-main">
          <ErrorBoundary>
            <ContactFormLazy />
          </ErrorBoundary>
          <div className="contact-alternatives">
            <p>
              {section.linkedinPrompt} <a href={section.linkedinHref}>{section.linkedinLabel}</a>
            </p>
            <p>{section.reply}</p>
          </div>
        </div>
        <div className="contact-side">
          <p className="contact-languages">{contactLanguageLine}</p>
          <div className="contact-email">
            <p>
              {section.emailLabel} <a href={`mailto:${section.email}`}>{section.email}</a>
            </p>
            <ContactCopyButton email={section.email} />
          </div>
        </div>
      </div>
    </Module>
  );
}
