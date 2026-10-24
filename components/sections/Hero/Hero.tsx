import { HeroStats } from '@/components/HeroStats';
import { heroContent } from '@/content/hero';
import { profile, profileLanguageLine, profileLocation } from '@/content/profile';
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
        <p className="hero-title">{profile.title}</p>
        <p className="hero-technologies">{profile.technologyLine}</p>
        <p className="hero-meta">
          <span>{heroContent.locationLabel}</span> {profileLocation}
        </p>
        <p className="hero-meta">
          <span>{heroContent.employerLabel}</span> <strong>{profile.currentEmployer.name}</strong>{' '}
          {profile.currentEmployer.context}
        </p>
        <p className="hero-meta">
          <span>{heroContent.languagesLabel}</span> {profileLanguageLine}
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
            <a key={action.href} href={action.href}>
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
