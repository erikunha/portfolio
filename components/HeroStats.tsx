import { heroStats } from '@/content/perf-receipts';
import { StatTile } from '@/design-system';
import styles from './HeroStats.module.css';

export function HeroStats() {
  return (
    <section className={styles.root} aria-label="Impact at scale" data-testid="hero-stats">
      {heroStats.map((stat) => (
        <div
          key={`${stat.value}|${stat.label}`}
          className={styles.item}
          data-testid="hero-stats-item"
        >
          <StatTile value={stat.value} label={stat.label} />
        </div>
      ))}
    </section>
  );
}
