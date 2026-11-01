import { HeroStats } from '@/components/HeroStats';
import { heroContent as c, heroTagline } from '@/content/hero';
import { profile, profileWorkingLanguageLine } from '@/content/profile';
import { Button } from '@/design-system';
import { HeroBootAnimation } from '../../client/HeroBootAnimation';
import { HeroSystemFailure } from '../../client/HeroSystemFailure';

const EXTERNAL_TARGET = '_blank';
const EXTERNAL_REL = 'noopener noreferrer';

const HEADING_LEVEL = 1;

function HeroIdentity({ primary }: { primary: boolean }) {
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
      <p className="hero-stack">{heroTagline}</p>
      <p className="hero-context">
        <span className="hero-context-fact hero-context-fact--location">
          <span className="hero-context-item">
            {c.locationLabel} <b className="hero-location">{profile.country}</b>
          </span>
          <span className="hero-context-separator" aria-hidden="true">
            {' · '}
          </span>
          <span className="hero-context-item">
            {profile.timezone} · {profile.availability}
          </span>
        </span>
        <span className="hero-context-fact hero-context-fact--employer">
          {c.employerLabel} <b>{profile.currentEmployer.name}</b>
        </span>
        <span className="hero-context-fact hero-context-fact--domain">
          {profile.currentEmployer.context}
        </span>
        <span className="hero-context-fact hero-context-fact--language">
          {c.languageLabel} {profileWorkingLanguageLine}
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

export function Hero() {
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
          <HeroIdentity primary />
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
          <HeroIdentity primary={false} />
        </div>
      </section>
    </>
  );
}
