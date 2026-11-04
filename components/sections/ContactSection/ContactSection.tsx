import { contactContent } from '@/content/contact';
import { copyFeedback } from '@/content/copy-button';
import { profilePresentation } from '@/content/profile';
import { SECTION_LABELS } from '@/content/section-labels';
import type { SiteLocale } from '@/content/site-locale';
import { social } from '@/content/social';
import { contactChrome, EXTERNAL_LINK_GLYPH } from '@/content/terminal-chrome';
import { ContactFormLazy } from '../../client/ContactForm';
import { ContactCopyButton } from '../../client/ContactForm/ContactCopyButton.client';
import { ContactTimezoneLazy, ContactTimezoneStatic } from '../../client/ContactTimezone';
import { ErrorBoundary } from '../../ErrorBoundary';
import { IconContact } from '../../Icons';
import { Module } from '../../responsive/Module';

export function ContactSection({ locale, defer }: { locale: SiteLocale; defer?: boolean } = {}) {
  const { section, channels, timezone } = contactContent[locale];
  const presentation = profilePresentation[locale];
  const { facts } = timezone;
  const factRows: ReadonlyArray<readonly [string, string]> = [
    [facts.availabilityLabel, presentation.availability],
    [facts.modeLabel, facts.modeValue],
    [facts.relocationLabel, facts.relocationValue],
    [facts.engagementLabel, facts.engagementValue],
    [facts.replyLabel, facts.replyValue],
    [channels.languagesLabel, presentation.languagesLine],
  ];
  return (
    <Module
      id="sec-contact"
      header={section.command}
      mobileHeader={section.mobileCommand}
      name={SECTION_LABELS[locale]['sec-contact']}
      icon={<IconContact />}
      defer={defer}
      variant="green"
    >
      <div className="contact-layout">
        <div className="contact-main">
          <ErrorBoundary>
            <ContactFormLazy
              copy={contactContent[locale]}
              chrome={contactChrome[locale]}
              loadingLabel={contactContent[locale].section.loadingLabel}
            />
          </ErrorBoundary>
          <div className="contact-reach">
            <section className="contact-channels ab-panel" aria-labelledby="contact-channels-title">
              <header className="ab-ph">
                <span className="ab-mk" aria-hidden="true">
                  {channels.marker}
                </span>
                <h3 className="ab-h" id="contact-channels-title">
                  {channels.title}
                </h3>
              </header>
              <div className="ab-body">
                <dl className="contact-channels-body">
                  <div className="contact-channel-row">
                    <dt>{channels.emailLabel}</dt>
                    <dd>
                      <a href={`mailto:${section.email}`}>{section.email}</a>
                      <ContactCopyButton
                        email={section.email}
                        copy={contactContent[locale]}
                        feedback={copyFeedback[locale]}
                      />
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
            </section>
            <dl className="contact-facts">
              {factRows.map(([label, value]) => (
                <div className="contact-fact" key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <aside className="contact-timezone ab-panel" aria-labelledby="contact-timezone-title">
          <header className="ab-ph">
            <span className="ab-mk" aria-hidden="true">
              {timezone.marker}
            </span>
            <h3 className="ab-h" id="contact-timezone-title">
              {timezone.title}
            </h3>
          </header>
          <div className="ab-body">
            <ContactTimezoneLazy copy={timezone}>
              <ContactTimezoneStatic />
            </ContactTimezoneLazy>
          </div>
        </aside>
      </div>
    </Module>
  );
}
