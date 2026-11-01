import { contactContent, contactLanguages } from '@/content/contact';
import { profile } from '@/content/profile';
import { SECTION_LABELS } from '@/content/section-labels';
import { social } from '@/content/social';
import { EXTERNAL_LINK_GLYPH } from '@/content/terminal-chrome';
import { ContactFormLazy } from '../../client/ContactForm';
import { ContactCopyButton } from '../../client/ContactForm/ContactCopyButton.client';
import { ErrorBoundary } from '../../ErrorBoundary';
import { IconContact } from '../../Icons';
import { Module } from '../../responsive/Module';

export function ContactSection({ defer }: { defer?: boolean } = {}) {
  const { section, channels } = contactContent;
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
        </div>
        <aside className="contact-channels ab-panel" aria-labelledby="contact-channels-title">
          <header className="ab-ph">
            <span className="ab-mk" aria-hidden="true">
              {channels.marker}
            </span>
            <h3 className="ab-h" id="contact-channels-title">
              {channels.title}
            </h3>
          </header>
          <dl className="contact-channels-body ab-body">
            <div className="contact-channel-row">
              <dt>{channels.emailLabel}</dt>
              <dd>
                <a href={`mailto:${section.email}`}>{section.email}</a>
                <ContactCopyButton email={section.email} />
              </dd>
            </div>
            <div className="contact-channel-row">
              <dt>{channels.linkedinLabel}</dt>
              <dd>
                <a
                  className="contact-channel-cta"
                  href={section.linkedinHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={channels.linkedinAccessibleLabel}
                >
                  {channels.linkedinCta}
                </a>
              </dd>
            </div>
            <div className="contact-channel-row">
              <dt>{channels.githubLabel}</dt>
              <dd>
                <a
                  className="contact-channel-link"
                  href={social.github}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={channels.githubAccessibleLabel}
                >
                  {social.githubLabel}
                  <span className="contact-channel-glyph" aria-hidden="true">
                    {EXTERNAL_LINK_GLYPH}
                  </span>
                </a>
              </dd>
            </div>
            <div className="contact-channel-row">
              <dt>{channels.replyLabel}</dt>
              <dd>{channels.replyValue}</dd>
            </div>
            <div className="contact-channel-row">
              <dt>{channels.languagesLabel}</dt>
              <dd>{contactLanguages}</dd>
            </div>
            <div className="contact-channel-row">
              <dt>{channels.timezoneLabel}</dt>
              <dd>{profile.timezone}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </Module>
  );
}
