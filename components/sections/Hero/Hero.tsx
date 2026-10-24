import { HeroStats } from '@/components/HeroStats';
import { heroAuthorization, heroContent, heroTagline } from '@/content/hero';
import { profile, profileLanguageLine } from '@/content/profile';
import { HeroBootAnimation } from '../../client/HeroBootAnimation';
import { HeroSystemFailure } from '../../client/HeroSystemFailure';

export function Hero() {
  return (
    <section
      id="bio"
      tabIndex={-1}
      aria-labelledby="hero-name"
      className="hero-identity"
      data-testid="hero-desktop"
    >
      <div className="hero-identity-body">
        <div className="hero-motion-mobile">
          <HeroBootAnimation variant="mobile" />
        </div>
        <h1 id="hero-name" data-testid="hero-name">
          {profile.displayName}
        </h1>
        <p className="hero-title">{heroTagline}</p>
        <p className="hero-meta">
          <span>
            {heroContent.locationLabel} <strong className="hero-country">{profile.country}</strong>
          </span>
          <span>
            {profile.timezone} · {profile.availability}
          </span>
          <span>
            {heroContent.employerLabel} <strong>{profile.currentEmployer.name}</strong>
          </span>
          <span>{profile.currentEmployer.context}</span>
          <span>
            {heroContent.languagesLabel} {profileLanguageLine}
          </span>
        </p>
        <p className="hero-relocation">
          <span className="badge-dot" aria-hidden="true" />
          {heroAuthorization}
        </p>
        <HeroStats />
        <div className="hero-actions" data-testid="hero-ctas">
          <a
            className="hero-hire"
            href={heroContent.hire.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={heroContent.hire.accessibleLabel}
          >
            {heroContent.hire.label}
          </a>
          {profile.actions.map((action) => (
            <a
              key={action.href}
              href={action.href}
              className={action.mobileOnly ? 'hero-action-mobile' : undefined}
            >
              {action.label}
            </a>
          ))}
        </div>
      </div>
      <div className="hero-motion-desktop">
        <HeroBootAnimation variant="desktop" />
      </div>
      <HeroSystemFailure />
    </section>
  );
}
