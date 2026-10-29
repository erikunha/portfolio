import { Suspense } from 'react';
import { MEASURED_FORMAT, measured, metricTimestamp } from '@/content/measured';
import {
  getScores,
  LIGHTHOUSE_FALLBACK,
  LIGHTHOUSE_TTL_S,
  type LighthouseScores,
  type Strategy,
} from '@/lib/lighthouse-scores';

export async function PerfData({ strategy }: { strategy: Strategy }) {
  const scores = await getScores(strategy).catch(() => null);
  return <PerfBody scores={scores} strategy={strategy} />;
}

function PerfBody({
  scores,
  strategy,
  loading = false,
}: {
  scores: LighthouseScores | null;
  strategy: Strategy;
  loading?: boolean;
}) {
  const unavailable = !scores || scores.fetchedAt === LIGHTHOUSE_FALLBACK.fetchedAt;
  const timestamp = metricTimestamp(
    unavailable ? undefined : scores.fetchedAt,
    LIGHTHOUSE_TTL_S * MEASURED_FORMAT.millisecondsPerSecond,
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
              {unavailable ? MEASURED_FORMAT.empty : scores[metric.key]}
              <span className="measured-out-of">{measured.psi.outOf}</span>
            </div>
            <div
              className="measured-bar"
              role="progressbar"
              aria-label={`${metric.label}: ${loading ? measured.loading : unavailable ? measured.unavailable : scores[metric.key]}`}
              aria-valuenow={unavailable ? undefined : scores[metric.key]}
              aria-valuemin={0}
              aria-valuemax={MEASURED_FORMAT.percentScale}
            >
              <i style={{ width: unavailable ? '0%' : `${scores[metric.key]}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LivePerfSection() {
  return (
    <div id="sec-live-perf" className="measured-lighthouse">
      <h3 className="measured-heading">{measured.psi.title}</h3>
      {measured.psi.strategies.map((strategy) => (
        <Suspense
          key={strategy.key}
          fallback={<PerfBody scores={null} strategy={strategy.key} loading />}
        >
          <PerfData strategy={strategy.key} />
        </Suspense>
      ))}
    </div>
  );
}
