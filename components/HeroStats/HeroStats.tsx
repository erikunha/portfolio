import { heroContent } from '@/content/hero';
import { heroStats } from '@/content/perf-receipts';
import { StatTile } from '@/design-system';

export function HeroStats({
  stats = heroStats,
}: {
  stats?: readonly (typeof heroStats)[number][];
} = {}) {
  return (
    <section className="hero-stats" aria-label={heroContent.statsLabel} data-testid="hero-stats">
      {stats.map((stat) => (
        <div key={stat.label} data-testid="hero-stats-item">
          <StatTile value={stat.value} label={stat.label} />
        </div>
      ))}
    </section>
  );
}
