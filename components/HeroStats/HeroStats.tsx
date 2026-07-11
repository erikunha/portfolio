import { heroStats } from '@/content/perf-receipts';
import { StatTile } from '@/design-system';

export function HeroStats() {
  return (
    <section
      className="hero-stats grid grid-cols-2 md:grid-cols-4 border border-primary-subtle mt-3"
      aria-label="Impact at scale"
      data-testid="hero-stats"
    >
      {heroStats.map((stat, index) => (
        <div
          key={`${stat.value}|${stat.label}`}
          className={[
            'border-r border-primary-subtle',
            index === heroStats.length - 1 ? 'border-r-0' : '',
            index % 2 === 1 ? 'max-md:border-r-0' : '',
            index < 2 ? 'max-md:border-b max-md:border-primary-subtle' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          data-testid="hero-stats-item"
        >
          <StatTile value={stat.value} label={stat.label} />
        </div>
      ))}
    </section>
  );
}
