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

export async function PerfData({ locale, strategy }: { locale: SiteLocale; strategy: Strategy }) {
  const scores = await getScores(strategy).catch(() => null);
  return <PerfBody locale={locale} scores={scores} strategy={strategy} />;
}

function PerfBody({
  locale,
  scores,
  strategy,
  loading = false,
}: {
  locale: SiteLocale;
  scores: LighthouseScores | null;
  strategy: Strategy;
  loading?: boolean;
}) {
  const measured = measuredContent[locale];
  const format = measured.format;
  const unavailable = !scores || scores.fetchedAt === LIGHTHOUSE_FALLBACK.fetchedAt;
  const timestamp = metricTimestamp(
    unavailable ? undefined : scores.fetchedAt,
    LIGHTHOUSE_TTL_S * format.millisecondsPerSecond,
    locale,
  );
  return (
    <div className="measured-perf" aria-busy={loading || undefined}>
      <h4 className="measured-subheading">
        <span className="live-dot" aria-hidden="true" />
        {measured.psi.strategies.find((entry) => entry.key === strategy)?.label}
      </h4>
      <p className="measured-status">
        <a
          href={`${measured.psi.url}&${measured.psi.strategyParameter}=${strategy}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {measured.psi.timestampLabel}
          <span className="sr-only"> {measured.externalDisclosure}</span>
        </a>{' '}
        {loading ? (
          measured.loading
        ) : unavailable ? (
          measured.unavailable
        ) : timestamp.valid ? (
          <time dateTime={scores.fetchedAt}>{timestamp.label}</time>
        ) : null}
        {timestamp.stale ? ` · ${measured.stale}` : null}
        {!unavailable && !timestamp.valid ? ` · ${measured.unknownTimestamp}` : null}
      </p>
      <div className="measured-scores">
        {measured.psi.metrics.map((metric) => (
          <div className="measured-score" key={metric.key}>
            <div className="measured-label">{metric.label}</div>
            <div className="measured-value">
              {unavailable ? format.empty : scores[metric.key]}
              <span className="measured-out-of">{measured.psi.outOf}</span>
            </div>
            <div
              className="measured-bar"
              role="progressbar"
              aria-label={`${metric.label}: ${loading ? measured.loading : unavailable ? measured.unavailable : scores[metric.key]}`}
              aria-valuenow={unavailable ? undefined : scores[metric.key]}
              aria-valuemin={0}
              aria-valuemax={format.percentScale}
            >
              <i style={{ width: unavailable ? '0%' : `${scores[metric.key]}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LivePerfSection({ locale }: { locale: SiteLocale }) {
  const measured = measuredContent[locale];
  return (
    <div id="sec-live-perf" className="measured-lighthouse grid-cols-1 md:grid-cols-2">
      <h3 className="measured-heading" data-type-reveal>
        {measured.psi.title}
      </h3>
      {measured.psi.strategies.map((strategy) => (
        <Suspense
          key={strategy.key}
          fallback={<PerfBody locale={locale} scores={null} strategy={strategy.key} loading />}
        >
          <PerfData locale={locale} strategy={strategy.key} />
        </Suspense>
      ))}
    </div>
  );
}
