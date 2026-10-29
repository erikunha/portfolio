import { HeroStats } from '@/components/HeroStats';
import { heroContent as c, heroAuthorization, heroTagline } from '@/content/hero';
import { profile, profileWorkingLanguageLine } from '@/content/profile';
import { Badge, Button } from '@/design-system';
import { HeroBootAnimation } from '../../client/HeroBootAnimation';
import { HeroSystemFailure } from '../../client/HeroSystemFailure';
import { RoleTyper } from '../../client/RoleTyper';

const EXTERNAL_TARGET = '_blank';
const EXTERNAL_REL = 'noopener noreferrer';

const HEADING_LEVEL = 1;
const TITLE_WORD_SEPARATOR = ' ';
const heroSeniority = profile.title.split(TITLE_WORD_SEPARATOR)[0] ?? '';
const heroTaglineRemainder = heroTagline.slice(heroSeniority.length);

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
      <p className="hero-stack">
        <span className="hero-role-slot">
          <RoleTyper className="hero-role-pill" />
        </span>
        {heroTaglineRemainder}
      </p>
      <p className="hero-context">
        <span>
          {c.locationLabel} <b className="hero-location">{profile.country}</b>
        </span>
        <span>
          {profile.timezone} · {profile.availability}
        </span>
        <span>
          {c.employerLabel} <b>{profile.currentEmployer.name}</b>
        </span>
        <span>{profile.currentEmployer.context}</span>
        <span>
          {c.languageLabel} {profileWorkingLanguageLine}
        </span>
      </p>
      <div className="hero-availability">
        <Badge variant="dot">{heroAuthorization}</Badge>
      </div>
      <HeroStats stats={c.stats} />
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
