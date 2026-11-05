import { CompanyLink } from '@/components/CompanyLink';
import { HeroStats } from '@/components/HeroStats';
import { heroContent, heroTagline } from '@/content/hero';
import { profile, profilePresentation } from '@/content/profile';
import type { SiteLocale } from '@/content/site-locale';
import { Button } from '@/design-system';
import { HeroBootAnimation } from '../../client/HeroBootAnimation';
import { HeroSystemFailure } from '../../client/HeroSystemFailure';

const EXTERNAL_TARGET = '_blank';
const EXTERNAL_REL = 'noopener noreferrer';

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
          </span>
          <span className="hero-context-separator" aria-hidden="true">
            {' · '}
          </span>
          <span className="hero-context-item">
            {profile.timezone} · {p.availability}
          </span>
        </span>
        <span className="hero-context-fact hero-context-fact--employer">
          {c.employerLabel}{' '}
          <b>
            <CompanyLink href={profile.currentEmployer.url}>
              {profile.currentEmployer.name}
            </CompanyLink>
          </b>
        </span>
        <span className="hero-context-fact hero-context-fact--domain">{p.employerContext}</span>
        <span className="hero-context-fact hero-context-fact--language">
          {c.languageLabel} {p.workingLanguageLine}
        </span>
      </p>
      <HeroStats stats={c.stats} label={c.statsLabel} />
      <div className="hero-actions" data-testid="hero-ctas">
        <Button
          as="a"
          variant="primary"
          href={c.hire.href}
          target={EXTERNAL_TARGET}
          rel={EXTERNAL_REL}
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
            target={action.external ? EXTERNAL_TARGET : undefined}
            rel={action.external ? EXTERNAL_REL : undefined}
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
      <section
        id="bio-mobile"
        tabIndex={-1}
        className="hero-mobile hero-frame"
        data-testid="hero-mobile"
      >
        <div className="hero-mobile-content">
          <HeroBootAnimation variant="mobile" />
          <HeroIdentity locale={locale} primary={false} />
        </div>
      </section>
    </>
  );
}
