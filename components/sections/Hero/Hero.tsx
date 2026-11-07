import { Fragment } from 'react';
import { CompanyLink } from '@/components/CompanyLink';
import { EXTERNAL_LINK_PROPS, externalLinkProps } from '@/components/ExternalLink';
import { HeroStats } from '@/components/HeroStats';
import { FACT_SEPARATOR } from '@/content/fact-separator';
import { heroContent, heroTagline } from '@/content/hero';
import { profile, profilePresentation } from '@/content/profile';
import type { SiteLocale } from '@/content/site-locale';
import { Button } from '@/design-system';
import { HeroBootAnimation } from '../../client/HeroBootAnimation';
import { HeroSystemFailure } from '../../client/HeroSystemFailure';

const HEADING_LEVEL = 1;

function HeroIdentity({ locale, primary }: { locale: SiteLocale; primary: boolean }) {
  const c = heroContent[locale];
  const p = profilePresentation[locale];
  return (
    <>
      {primary ? (
        <h1 className="hero-identity" data-testid="hero-name">
          {profile.displayName}
        </h1>
      ) : (
        // biome-ignore lint/a11y/useSemanticElements: a second h1 would duplicate the page title in the DOM; the desktop variant owns the only h1
        <p
          className="hero-identity"
          data-testid="hero-name"
          role="heading"
          aria-level={HEADING_LEVEL}
        >
          {profile.displayName}
        </p>
      )}
      <p className="hero-stack">{heroTagline(locale)}</p>
      <p className="hero-context">
        <span className="hero-context-fact hero-context-fact--location">
          <span className="hero-context-item">
            {c.locationLabel} <b className="hero-location">{p.country}</b>
          </span>{' '}
          <span className="hero-context-item">
            {profile.timezone}
            {FACT_SEPARATOR}
            {p.availability}
          </span>
        </span>{' '}
        <span className="hero-context-fact hero-context-fact--employer">
          <span className="hero-context-item">
            {c.employerLabel}{' '}
            <b>
              <CompanyLink href={profile.currentEmployer.url} locale={locale}>
                {profile.currentEmployer.name}
              </CompanyLink>
            </b>
          </span>
        </span>{' '}
        <span className="hero-context-fact hero-context-fact--domain">
          {p.employerContextFacts.map((part) => (
            <Fragment key={part}>
              <span className="hero-context-item">{part}</span>{' '}
            </Fragment>
          ))}
        </span>{' '}
        <span className="hero-context-fact hero-context-fact--language">
          <span className="hero-context-item">
            {c.languageLabel} {p.workingLanguageLine}
          </span>
        </span>
      </p>
      <HeroStats stats={c.stats} label={c.statsLabel} />
      <div className="hero-actions" data-testid="hero-ctas">
        <Button
          as="a"
          variant="primary"
          href={c.hire.href}
          {...EXTERNAL_LINK_PROPS}
          aria-label={c.hire.accessibleLabel}
        >
          {c.hire.label}
        </Button>
        {c.actions.map((action) => (
          <Button
            key={action.href}
            as="a"
            variant="secondary"
            href={action.href}
            {...externalLinkProps(action.external)}
            aria-label={action.accessibleLabel}
            className={action.hiddenOnWide ? 'lg:hidden' : undefined}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </>
  );
}

export function Hero({ locale }: { locale: SiteLocale }) {
  return (
    <>
      <section
        id="bio"
        tabIndex={-1}
        className="hero-desktop hero-frame"
        data-testid="hero-desktop"
      >
        <div className="hero-terminal">
          <HeroBootAnimation variant="desktop" />
        </div>
        <aside className="hero-bio">
          <HeroIdentity locale={locale} primary />
        </aside>
        <HeroSystemFailure />
      </section>
      <section tabIndex={-1} className="hero-mobile hero-frame" data-testid="hero-mobile">
        <div className="hero-mobile-content">
          <HeroBootAnimation variant="mobile" />
          <HeroIdentity locale={locale} primary={false} />
        </div>
      </section>
    </>
  );
}
