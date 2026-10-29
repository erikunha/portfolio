import { CopyButton } from '@/app/design-system/_components/CopyButton';
import { contactContent } from '@/content/contact';
import { SECTION_LABELS } from '@/content/section-labels';
import { ContactFormLazy } from '../../client/ContactForm';
import { ErrorBoundary } from '../../ErrorBoundary';
import { IconContact } from '../../Icons';
import { Module } from '../../responsive/Module';
import { VisaContent } from '../VisaSection/VisaSection';

export function ContactSection({ defer }: { defer?: boolean } = {}) {
  const { section } = contactContent;
  return (
    <Module
      id="sec-contact"
      header={section.command}
      mobileHeader={section.mobileCommand}
      srLabel={SECTION_LABELS['sec-contact']}
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
          <VisaContent />
          <div className="contact-email">
            <p>
              {section.emailLabel} <a href={`mailto:${section.email}`}>{section.email}</a>
            </p>
            <CopyButton text={section.email} aria-label={section.copyEmail} />
          </div>
        </div>
      </div>
    </Module>
  );
}
