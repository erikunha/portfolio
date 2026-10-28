import { Suspense } from 'react';
import { MEASURED_FORMAT, measured, metricTimestamp } from '@/content/measured';
import { SECTION_LABELS } from '@/content/section-labels';
import type { AskMetrics } from '@/lib/ask-metrics';
import { getAskMetrics } from '@/lib/ask-metrics';
import { IconAiMetrics } from '../../Icons';
import { Module } from '../../responsive/Module';
import { LivePerfSection } from '../LivePerfSection';

const percent = (rate: number) =>
  `${Math.round(rate * MEASURED_FORMAT.percentScale)}${measured.ask.percentUnit}`;
const latency = (value: number) =>
  `${Math.round(value).toLocaleString(MEASURED_FORMAT.locale)}${measured.ask.latencyUnit}`;
const formatMetric = {
  evalPassRate: percent,
  jailbreakResistance: percent,
  p95LatencyMs: latency,
  costPerAnswer: (value: number) =>
    `${measured.ask.currencyUnit}${value.toFixed(MEASURED_FORMAT.costPrecision)}`,
};

function AiMetricsBody({
  metrics,
  loading = false,
}: {
  metrics: AskMetrics | null;
  loading?: boolean;
}) {
  const timestamp = metricTimestamp(metrics?.lastRun, MEASURED_FORMAT.askStaleAfterMs);
  return (
    <div className="measured-ask" aria-busy={loading || undefined}>
      <h3 className="measured-heading">
        <a href={measured.ask.url} target="_blank" rel="noopener noreferrer">
          {measured.ask.title}
          <span className="sr-only"> {measured.externalDisclosure}</span>
        </a>
        {timestamp.valid ? (
          <>
            {' · '}
            {measured.ask.timestampLabel} <time dateTime={metrics?.lastRun}>{timestamp.label}</time>
          </>
        ) : null}
        {timestamp.stale ? <span className="measured-status"> · {measured.stale}</span> : null}
      </h3>
      <div className="measured-tiles">
        {measured.ask.metrics.map((metric) => (
          <div className="measured-tile" data-metric key={metric.key}>
            <div className="measured-label">{metric.label}</div>
            <div className="measured-value">
              {metrics ? formatMetric[metric.key](metrics[metric.key]) : MEASURED_FORMAT.empty}
            </div>
            <div className="measured-description">
              {metric.description ||
                (metrics
                  ? `${measured.ask.p95Prefix} ${latency(metrics.p95LatencyMs)}`
                  : measured.ask.p95Pending)}
            </div>
          </div>
        ))}
      </div>
      {!metrics ? (
        <p className="measured-status">{loading ? measured.loading : measured.ask.pending}</p>
      ) : null}
      {metrics && !timestamp.valid ? (
        <p className="measured-status">{measured.unknownTimestamp}</p>
      ) : null}
    </div>
  );
}

export async function AiMetricsData() {
  const metrics = await getAskMetrics().catch(() => null);
  return <AiMetricsBody metrics={metrics} />;
}

export function AiMetricsSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-live-metrics"
      header={measured.command}
      variant="green"
      srLabel={SECTION_LABELS['sec-live-metrics']}
      icon={<IconAiMetrics />}
      defer={defer}
    >
      <span id="sec-ai-metrics" />
      <p className="measured-source">
        {measured.sourceLabel}{' '}
        <a href={measured.psi.url} target="_blank" rel="noopener noreferrer">
          {measured.psi.source}
          <span className="sr-only"> {measured.externalDisclosure}</span>
        </a>
        {' · '}
        <a href={measured.ask.url} target="_blank" rel="noopener noreferrer">
          {measured.ask.source}
          <span className="sr-only"> {measured.externalDisclosure}</span>
        </a>
        {' ('}
        {measured.ask.cacheKey}
        {')'}
      </p>
      <div className="measured-grid">
        <Suspense fallback={<AiMetricsBody metrics={null} loading />}>
          <AiMetricsData />
        </Suspense>
        <LivePerfSection />
      </div>
    </Module>
  );
}
