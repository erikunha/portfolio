import { heroStats } from '@/content/perf-receipts';
import { StatTile } from '@/design-system';

export function HeroStats() {
  return (
    <section
      className="hero-stats grid grid-cols-2 md:grid-cols-4 border border-signal-subtle mt-3"
      aria-label="Impact at scale"
      data-testid="hero-stats"
    >
      {heroStats.map((stat, index) => (
        <div
          key={`${stat.value}|${stat.label}`}
          className={[
            'border-r border-signal-subtle',
            // Remove right border from last in each row
            // Desktop: 4-col — item 4 (index 3) has no right border
            // Mobile: 2-col — item 2 (index 1) and item 4 (index 3) have no right border
            index === heroStats.length - 1 ? 'border-r-0' : '',
            // On mobile, 2-col layout — 2nd column items (odd indices) have no right border
            index % 2 === 1 ? 'max-md:border-r-0' : '',
            // Bottom border on first row in mobile 2-col layout (items 0 and 1)
            index < 2 ? 'max-md:border-b max-md:border-signal-subtle' : '',
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
