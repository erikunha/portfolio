import { Suspense } from 'react';
import { type Measured, measured as measuredContent, metricTimestamp } from '@/content/measured';
import { SECTION_LABELS } from '@/content/section-labels';
import type { SiteLocale } from '@/content/site-locale';
import type { AskMetrics } from '@/lib/ask-metrics';
import { getAskMetrics } from '@/lib/ask-metrics';
import { IconAiMetrics } from '../../Icons';
import { Module } from '../../responsive/Module';
import { LivePerfSection } from '../LivePerfSection';

const percent = (content: Measured) => (rate: number) =>
  `${Math.round(rate * content.format.percentScale)}${content.ask.percentUnit}`;
const latency = (content: Measured) => (value: number) =>
  `${Math.round(value).toLocaleString(content.format.locale)}${content.ask.latencyUnit}`;
const formatMetricFor = (content: Measured) => ({
  evalPassRate: percent(content),
  jailbreakResistance: percent(content),
  p95LatencyMs: latency(content),
  costPerAnswer: (value: number) =>
    `${content.ask.currencyUnit}${value.toFixed(content.format.costPrecision)}`,
});

function AiMetricsBody({
  locale,
  metrics,
  loading = false,
  unavailable = false,
}: {
  locale: SiteLocale;
  metrics: AskMetrics | null;
  loading?: boolean;
  unavailable?: boolean;
}) {
  const content = measuredContent[locale];
  const format = content.format;
  const formatMetric = formatMetricFor(content);
  const timestamp = metricTimestamp(metrics?.lastRun, format.askStaleAfterMs, locale);
  return (
    <div className="measured-ask" aria-busy={loading || undefined}>
      <h3 className="measured-heading">
        <a href={content.ask.url} target="_blank" rel="noopener noreferrer">
          <span data-type-reveal>{content.ask.title}</span>
          <span className="sr-only"> {content.externalDisclosure}</span>
        </a>
        {metrics ? (
          <>
            {' · '}
            {content.ask.timestampLabel}{' '}
            {timestamp.valid ? (
              <time dateTime={metrics.lastRun}>{timestamp.label}</time>
            ) : (
              metrics.lastRun
            )}
          </>
        ) : null}
        {timestamp.stale ? <span className="measured-status"> · {content.stale}</span> : null}
      </h3>
      <div className="measured-tiles">
        {content.ask.metrics.map((metric) => (
          <div className="measured-tile" data-metric key={metric.key}>
            <div className="measured-label">{metric.label}</div>
            <div className="measured-value">
              {metrics ? formatMetric[metric.key](metrics[metric.key]) : format.empty}
            </div>
            <div className="measured-description">
              {metric.description ||
                (metrics
                  ? `${content.ask.p95Prefix} ${formatMetric.p95LatencyMs(metrics.p95LatencyMs)}`
                  : content.ask.p95Pending)}
            </div>
          </div>
        ))}
      </div>
      {!metrics ? (
        <p className="measured-status">
          {loading ? content.loading : unavailable ? content.ask.unavailable : content.ask.pending}
        </p>
      ) : null}
      {metrics && !timestamp.valid ? (
        <p className="measured-status">{content.unknownTimestamp}</p>
      ) : null}
    </div>
  );
}

export async function AiMetricsData({ locale }: { locale: SiteLocale }) {
  try {
    const metrics = await getAskMetrics();
    return <AiMetricsBody locale={locale} metrics={metrics} />;
  } catch {
    return <AiMetricsBody locale={locale} metrics={null} unavailable />;
  }
}

export function AiMetricsSection({ locale, defer }: { locale: SiteLocale; defer?: boolean } = {}) {
  const content = measuredContent[locale];
  return (
    <Module
      id="sec-live-metrics"
      header={content.command}
      variant="green"
      name={SECTION_LABELS[locale]['sec-live-metrics']}
      icon={<IconAiMetrics />}
      defer={defer}
    >
      <span id="sec-ai-metrics" />
      <p className="measured-source">
        {content.sourceLabel}{' '}
        <a href={content.psi.url} target="_blank" rel="noopener noreferrer">
          {content.psi.source}
          <span className="sr-only"> {content.externalDisclosure}</span>
        </a>
        {' · '}
        <a href={content.ask.url} target="_blank" rel="noopener noreferrer">
          {content.ask.source}
          <span className="sr-only"> {content.externalDisclosure}</span>
        </a>
        {' ('}
        {content.ask.cacheKey}
        {')'}
      </p>
      <div className="measured-grid">
        <Suspense fallback={<AiMetricsBody locale={locale} metrics={null} loading />}>
          <AiMetricsData locale={locale} />
        </Suspense>
        <LivePerfSection locale={locale} />
      </div>
    </Module>
  );
}
