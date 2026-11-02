import { contactContent, contactLanguages } from '@/content/contact';
import { profile } from '@/content/profile';
import { SECTION_LABELS } from '@/content/section-labels';
import { social } from '@/content/social';
import { EXTERNAL_LINK_GLYPH } from '@/content/terminal-chrome';
import { ContactFormLazy } from '../../client/ContactForm';
import { ContactCopyButton } from '../../client/ContactForm/ContactCopyButton.client';
import { ContactTimezoneLazy, ContactTimezoneStatic } from '../../client/ContactTimezone';
import { ErrorBoundary } from '../../ErrorBoundary';
import { IconContact } from '../../Icons';
import { Module } from '../../responsive/Module';

export function ContactSection({ defer }: { defer?: boolean } = {}) {
  const { section, channels, timezone } = contactContent;
  const { facts } = timezone;
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
          <div className="ab-body">
            <ContactTimezoneLazy>
              <ContactTimezoneStatic />
            </ContactTimezoneLazy>
            <div className="ctz-footer">
              <dl className="ctz-facts">
                <div className="ctz-fact">
                  <dt>{facts.availabilityLabel}</dt>
                  <dd>{profile.availability}</dd>
                </div>
                <div className="ctz-fact">
                  <dt>{facts.modeLabel}</dt>
                  <dd>{facts.modeValue}</dd>
                </div>
                <div className="ctz-fact">
                  <dt>{facts.relocationLabel}</dt>
                  <dd>{facts.relocationValue}</dd>
                </div>
                <div className="ctz-fact">
                  <dt>{facts.engagementLabel}</dt>
                  <dd>{facts.engagementValue}</dd>
                </div>
                <div className="ctz-fact">
                  <dt>{facts.replyLabel}</dt>
                  <dd>{facts.replyValue}</dd>
                </div>
                <div className="ctz-fact">
                  <dt>{channels.languagesLabel}</dt>
                  <dd>{contactLanguages}</dd>
                </div>
                <div className="ctz-fact">
                  <dt>{channels.timezoneLabel}</dt>
                  <dd>{profile.timezone}</dd>
                </div>
              </dl>
              <dl className="contact-channels-body">
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
                    >
                      {channels.linkedinCta}{' '}
                      <span aria-hidden="true">{channels.linkedinGlyph}</span>
                      <span className="sr-only"> {channels.linkedinNewTabNote}</span>
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
              </dl>
            </div>
          </div>
        </aside>
      </div>
    </Module>
  );
}
