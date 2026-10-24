import { heroContent, heroStats } from '@/content/hero';

export function HeroStats() {
  return (
    <section className="hero-stats" aria-label={heroContent.statsLabel} data-testid="hero-stats">
      <dl className="hero-stat-list">
        {heroStats.map((stat) => (
          <div key={stat.label} className="hero-stat" data-testid="hero-stats-item">
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
