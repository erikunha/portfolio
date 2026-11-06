import { ExternalLink } from '@/components/ExternalLink';
import { Panel } from '@/components/Panel';
import { contactContent } from '@/content/contact';
import { timezonePlaceholderRows } from '@/content/contact-rules';
import { copyFeedback } from '@/content/copy-button';
import { profilePresentation } from '@/content/profile';
import { SECTION_LABELS } from '@/content/section-labels';
import type { SiteLocale } from '@/content/site-locale';
import { social } from '@/content/social';
import { contactChrome, EXTERNAL_LINK_GLYPH } from '@/content/terminal-chrome';
import { ERIK_PIN } from '@/content/world-map';
import { ContactFormLazy } from '../../client/ContactForm';
import { ContactCopyButton } from '../../client/ContactForm/ContactCopyButton.client';
import { ContactTimezoneLazy, ContactTimezoneStatic } from '../../client/ContactTimezone';
import { ErrorBoundary } from '../../ErrorBoundary';
import { IconContact } from '../../Icons';
import { Module } from '../../responsive/Module';

export function ContactSection({ locale, defer }: { locale: SiteLocale; defer?: boolean }) {
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
          <ErrorBoundary locale={locale}>
            <ContactFormLazy
              copy={contactContent[locale]}
              chrome={contactChrome[locale]}
              loadingLabel={contactContent[locale].section.loadingLabel}
            />
          </ErrorBoundary>
          <noscript>
            <p className="contact-nojs" data-testid="contact-nojs">
              {section.noscript} <a href={`mailto:${section.email}`}>{section.email}</a>
            </p>
          </noscript>
          <div className="contact-reach">
            <Panel
              as="section"
              className="contact-channels"
              title={channels.title}
              marker={channels.marker}
              titleId="contact-channels-title"
            >
              <div className="ab-body">
                <dl className="contact-channels-body">
                  <div className="contact-channel-row">
                    <dt>{channels.emailLabel}</dt>
                    <dd>
                      <a href={`mailto:${section.email}`}>{section.email}</a>
                      <ContactCopyButton
                        value={section.email}
                        labels={{ copy: section.copyEmail, copied: section.copyEmailCopied }}
                        feedback={copyFeedback[locale]}
                      />
                    </dd>
                  </div>
                  <div className="contact-channel-row">
                    <dt>{channels.linkedinLabel}</dt>
                    <dd>
                      <ExternalLink className="contact-channel-cta" href={section.linkedinHref}>
                        {channels.linkedinCta}{' '}
                        <span aria-hidden="true">{channels.linkedinGlyph}</span>
                        <span className="sr-only"> {channels.linkedinNewTabNote}</span>
                      </ExternalLink>
                    </dd>
                  </div>
                  <div className="contact-channel-row">
                    <dt>{channels.githubLabel}</dt>
                    <dd>
                      <ExternalLink
                        className="contact-channel-link"
                        href={social.github}
                        aria-label={channels.githubAccessibleLabel}
                      >
                        {social.githubLabel}
                        <span className="contact-channel-glyph" aria-hidden="true">
                          {EXTERNAL_LINK_GLYPH}
                        </span>
                      </ExternalLink>
                    </dd>
                  </div>
                </dl>
              </div>
            </Panel>
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
        <Panel
          as="aside"
          className="contact-timezone"
          title={timezone.title}
          marker={timezone.marker}
          titleId="contact-timezone-title"
          data-locale={locale}
        >
          <div className="ab-body">
            <ContactTimezoneLazy copy={timezone}>
              <ContactTimezoneStatic
                loadingLabel={timezone.loading}
                placeholderRows={timezonePlaceholderRows(timezone.map, ERIK_PIN.code)}
              />
            </ContactTimezoneLazy>
          </div>
        </Panel>
      </div>
    </Module>
  );
}
