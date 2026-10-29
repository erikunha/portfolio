import { StatTile, type StatTileProps } from '@/design-system';

type HeroStatsProps = {
  stats: readonly Pick<StatTileProps, 'value' | 'label'>[];
  label: string;
};

export function HeroStats({ stats, label }: HeroStatsProps) {
  return (
    <section className="hero-stats" aria-label={label} data-testid="hero-stats">
      {stats.map((stat) => (
        <div key={stat.label} data-testid="hero-stats-item">
          <StatTile value={stat.value} label={stat.label} />
        </div>
      ))}
    </section>
  );
}
