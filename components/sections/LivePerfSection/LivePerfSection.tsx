import { type ReactNode, Suspense } from 'react';
import { ExternalLink } from '@/components/ExternalLink';
import { measured as measuredContent, metricTimestamp } from '@/content/measured';
import type { SiteLocale } from '@/content/site-locale';
import {
  getScores,
  LIGHTHOUSE_FALLBACK,
  LIGHTHOUSE_TTL_S,
  type LighthouseScores,
  type Strategy,
} from '@/lib/lighthouse-scores';
import { MeasuredStatus } from '../MeasuredStatus';

type ScoresByStrategy = Record<Strategy, LighthouseScores | null>;

export const MEASURED_FIELD_SEPARATOR = ' · ';

export function MeasuredLink({
  href,
  disclosure,
  children,
}: {
  href: string;
  disclosure: string;
  children: ReactNode;
}) {
  return (
    <ExternalLink href={href}>
      {children}
      <span className="sr-only"> {disclosure}</span>
    </ExternalLink>
  );
}

export function MeasuredTile({
  label,
  value,
  description,
}: {
  label: string;
  value: ReactNode;
  description: ReactNode;
}) {
  return (
    <div className="measured-tile" data-metric>
      <div className="measured-label">{label}</div>
      <div className="measured-value">{value}</div>
      <div className="measured-description">{description}</div>
    </div>
  );
}

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

type Measured = (typeof measuredContent)[SiteLocale];

function perfStatusMessage(
  measured: Measured,
  state: {
    loading: boolean;
    unavailable: boolean;
    showTimestamp: boolean;
    timestamp: ReturnType<typeof metricTimestamp>;
  },
) {
  if (state.loading) return measured.loading;
  if (state.unavailable) return measured.unavailable;
  return state.showTimestamp && !state.timestamp.valid ? measured.unknownTimestamp : null;
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
  const dated = available.filter((entry) => !Number.isNaN(Date.parse(entry.fetchedAt)));
  const unavailable = available.length === 0;
  const datedSource = dated.length > 0 ? dated : available;
  const timestamp = metricTimestamp(
    datedSource.length > 0 ? oldestFetchedAt(datedSource) : undefined,
    LIGHTHOUSE_TTL_S * format.millisecondsPerSecond,
    locale,
  );
  const showTimestamp = !loading && available.length > 0;
  return (
    <div className="measured-perf" aria-busy={loading || undefined}>
      <h3 className="measured-heading">
        <MeasuredLink href={psi.url} disclosure={measured.externalDisclosure}>
          <span data-type-reveal suppressHydrationWarning>
            {psi.title}
          </span>
        </MeasuredLink>
        {showTimestamp && timestamp.valid ? (
          <>
            {MEASURED_FIELD_SEPARATOR}
            {psi.timestampLabel}{' '}
            <time dateTime={oldestFetchedAt(datedSource)}>{timestamp.label}</time>
          </>
        ) : null}
        {showTimestamp && timestamp.stale ? (
          <span className="measured-status">
            {MEASURED_FIELD_SEPARATOR}
            {measured.stale}
          </span>
        ) : null}
      </h3>
      <div className="measured-tiles">
        {psi.metrics.map((metric) => (
          <MeasuredTile
            key={metric.key}
            label={metric.label}
            value={psi.strategies
              .map((strategy) => {
                const strategyScores = scores?.[strategy.key];
                return isAvailable(strategyScores) ? strategyScores[metric.key] : format.empty;
              })
              .join(psi.pairSeparator)}
            description={psi.strategies.map((strategy) => strategy.label).join(psi.pairSeparator)}
          />
        ))}
      </div>
      <MeasuredStatus
        message={perfStatusMessage(measured, { loading, unavailable, showTimestamp, timestamp })}
        live
        reserve={[measured.loading, measured.unavailable, measured.unknownTimestamp]}
      />
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
