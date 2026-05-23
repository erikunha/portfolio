import { heroStats } from '@/content/perf-receipts';
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
          <span className={styles.value} data-testid="hero-stats-value">
            {stat.value}
          </span>
          <span className={styles.label} data-testid="hero-stats-label">
            {stat.label}
          </span>
        </div>
      ))}
    </section>
  );
}
