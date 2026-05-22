import { heroStats } from '@/content/perf-receipts';

export function HeroStats() {
  return (
    <section className="hero-stats" aria-label="Impact at scale">
      {heroStats.map((stat) => (
        <div key={`${stat.value}|${stat.label}`} className="hero-stats__item">
          <span className="hero-stats__value">{stat.value}</span>
          <span className="hero-stats__label">{stat.label}</span>
        </div>
      ))}
    </section>
  );
}
