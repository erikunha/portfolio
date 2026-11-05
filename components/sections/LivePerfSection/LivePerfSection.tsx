import { Suspense } from 'react';
import { measured as measuredContent, metricTimestamp } from '@/content/measured';
import type { SiteLocale } from '@/content/site-locale';
import {
  getScores,
  LIGHTHOUSE_FALLBACK,
  LIGHTHOUSE_TTL_S,
  type LighthouseScores,
  type Strategy,
} from '@/lib/lighthouse-scores';

type ScoresByStrategy = Record<Strategy, LighthouseScores | null>;

const isAvailable = (scores: LighthouseScores | null | undefined): scores is LighthouseScores =>
  Boolean(scores) && scores?.fetchedAt !== LIGHTHOUSE_FALLBACK.fetchedAt;

const oldestFetchedAt = (available: LighthouseScores[]) =>
  available
    .map((scores) => scores.fetchedAt)
    .reduce((a, b) => (Date.parse(b) < Date.parse(a) ? b : a));

export async function PerfData({ locale }: { locale: SiteLocale }) {
  const strategies = measuredContent[locale].psi.strategies;
  const results = await Promise.all(
    strategies.map((strategy) => getScores(strategy.key).catch(() => null)),
  );
  const scores = Object.fromEntries(
    strategies.map((strategy, index) => [strategy.key, results[index] ?? null]),
  ) as ScoresByStrategy;
  return <PerfBody locale={locale} scores={scores} />;
}

function PerfBody({
  locale,
  scores,
  loading = false,
}: {
  locale: SiteLocale;
  scores: ScoresByStrategy | null;
  loading?: boolean;
}) {
  const measured = measuredContent[locale];
  const format = measured.format;
  const { psi } = measured;
  const available = scores ? Object.values(scores).filter(isAvailable) : [];
  const unavailable = !scores || available.length < psi.strategies.length;
  const timestamp = metricTimestamp(
    available.length > 0 ? oldestFetchedAt(available) : undefined,
    LIGHTHOUSE_TTL_S * format.millisecondsPerSecond,
    locale,
  );
  const showTimestamp = !loading && available.length > 0;
  return (
    <div className="measured-perf" aria-busy={loading || undefined}>
      <h3 className="measured-heading">
        <a href={psi.url} target="_blank" rel="noopener noreferrer">
          <span data-type-reveal suppressHydrationWarning>
            {psi.title}
          </span>
          <span className="sr-only"> {measured.externalDisclosure}</span>
        </a>
        {showTimestamp && timestamp.valid ? (
          <>
            {' · '}
            {psi.timestampLabel}{' '}
            <time dateTime={oldestFetchedAt(available)}>{timestamp.label}</time>
          </>
        ) : null}
        {showTimestamp && timestamp.stale ? (
          <span className="measured-status"> · {measured.stale}</span>
        ) : null}
      </h3>
      <div className="measured-tiles">
        {psi.metrics.map((metric) => (
          <div className="measured-tile" data-metric key={metric.key}>
            <div className="measured-label">{metric.label}</div>
            <div className="measured-value">
              {psi.strategies
                .map((strategy) => {
                  const strategyScores = scores?.[strategy.key];
                  return isAvailable(strategyScores) ? strategyScores[metric.key] : format.empty;
                })
                .join(psi.pairSeparator)}
            </div>
            <div className="measured-description">
              {psi.strategies.map((strategy) => strategy.label).join(psi.pairSeparator)}
            </div>
          </div>
        ))}
      </div>
      {loading || unavailable || (showTimestamp && !timestamp.valid) ? (
        <p className="measured-status">
          {loading
            ? measured.loading
            : unavailable
              ? measured.unavailable
              : measured.unknownTimestamp}
        </p>
      ) : null}
    </div>
  );
}

export function LivePerfSection({ locale }: { locale: SiteLocale }) {
  return (
    <div id="sec-live-perf">
      <Suspense fallback={<PerfBody locale={locale} scores={null} loading />}>
        <PerfData locale={locale} />
      </Suspense>
    </div>
  );
}
