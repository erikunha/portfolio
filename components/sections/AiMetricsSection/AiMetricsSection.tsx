import { headers } from 'next/headers';
import { unstable_rethrow } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import {
  type Measured,
  measured as measuredContent,
  measuredStates,
  metricTimestamp,
} from '@/content/measured';
import { ERROR_SECONDS_TOKEN } from '@/content/measured-states.schema';
import { SECTION_LABELS } from '@/content/section-labels';
import type { SiteLocale } from '@/content/site-locale';
import type { AskMetrics } from '@/lib/ask-metrics';
import { getAskMetrics } from '@/lib/ask-metrics';
import { SSR_REDIS_TIMEOUT_MS } from '@/lib/with-timeout';
import { IconAiMetrics } from '../../Icons';
import { Module } from '../../responsive/Module';
import {
  LivePerfSection,
  MEASURED_FIELD_SEPARATOR,
  MeasuredLink,
  MeasuredTile,
} from '../LivePerfSection';
import { MeasuredStatus } from '../MeasuredStatus';

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

const REQUEST_REF_HEADER = 'x-vercel-id';
const RETRY_HREF = '?retry=1#sec-live-metrics';
const MS_PER_SECOND = 1000;

async function readRequestRef(): Promise<string | undefined> {
  try {
    return (await headers()).get(REQUEST_REF_HEADER) ?? undefined;
  } catch (error) {
    unstable_rethrow(error);
    return undefined;
  }
}

function AskError({ locale, requestRef }: { locale: SiteLocale; requestRef?: string | undefined }) {
  const { askError } = measuredStates[locale];
  return (
    <div className="measured-error" role="alert">
      <strong>{askError.heading}</strong>
      <p>
        {askError.body.replace(ERROR_SECONDS_TOKEN, String(SSR_REDIS_TIMEOUT_MS / MS_PER_SECOND))}
      </p>
      <a className="measured-retry" href={RETRY_HREF}>
        {askError.retry}
      </a>
      {requestRef ? (
        <span className="measured-error-ref" title={requestRef}>
          {askError.refLabel} {requestRef}
        </span>
      ) : null}
    </div>
  );
}

const CACHE_KEY_OPEN = ' (';
const CACHE_KEY_CLOSE = ')';

function askStatusMessage(
  content: Measured,
  state: {
    metrics: AskMetrics | null;
    loading: boolean;
    timestamp: ReturnType<typeof metricTimestamp>;
  },
) {
  if (state.metrics) return state.timestamp.valid ? null : content.unknownTimestamp;
  return state.loading ? content.loading : content.ask.pending;
}

function AiMetricsBody({
  locale,
  metrics,
  loading = false,
  failed = false,
  requestRef,
}: {
  locale: SiteLocale;
  metrics: AskMetrics | null;
  loading?: boolean;
  failed?: boolean;
  requestRef?: string | undefined;
}) {
  const content = measuredContent[locale];
  const format = content.format;
  const formatMetric = formatMetricFor(content);
  const timestamp = metricTimestamp(metrics?.lastRun, format.askStaleAfterMs, locale);
  return (
    <div className="measured-ask" aria-busy={loading || undefined}>
      <h3 className="measured-heading">
        <MeasuredLink href={content.ask.url} disclosure={content.externalDisclosure}>
          <span data-type-reveal suppressHydrationWarning>
            {content.ask.title}
          </span>
        </MeasuredLink>
        {metrics ? (
          <>
            {MEASURED_FIELD_SEPARATOR}
            {content.ask.timestampLabel}{' '}
            {timestamp.valid ? (
              <time dateTime={metrics.lastRun}>{timestamp.label}</time>
            ) : (
              metrics.lastRun
            )}
          </>
        ) : null}
        {timestamp.stale ? (
          <span className="measured-status">
            {MEASURED_FIELD_SEPARATOR}
            {content.stale}
          </span>
        ) : null}
      </h3>
      {failed ? (
        <AskError locale={locale} requestRef={requestRef} />
      ) : (
        <>
          <div className="measured-tiles">
            {content.ask.metrics.map((metric) => (
              <MeasuredTile
                key={metric.key}
                label={metric.label}
                value={metrics ? formatMetric[metric.key](metrics[metric.key]) : format.empty}
                description={
                  metric.description ||
                  (metrics
                    ? `${content.ask.p95Prefix} ${formatMetric.p95LatencyMs(metrics.p95LatencyMs)}`
                    : content.ask.p95Pending)
                }
              />
            ))}
          </div>
          <MeasuredStatus
            message={askStatusMessage(content, { metrics, loading, timestamp })}
            live={!metrics}
            reserve={[
              content.loading,
              content.ask.unavailable,
              content.ask.pending,
              content.unknownTimestamp,
            ]}
          />
        </>
      )}
    </div>
  );
}

export async function AiMetricsData({ locale }: { locale: SiteLocale }) {
  await connection();
  try {
    const metrics = await getAskMetrics();
    return <AiMetricsBody locale={locale} metrics={metrics} />;
  } catch {
    const requestRef = await readRequestRef();
    return <AiMetricsBody locale={locale} metrics={null} failed requestRef={requestRef} />;
  }
}

export function AiMetricsSection({ locale, defer }: { locale: SiteLocale; defer?: boolean }) {
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
        <MeasuredLink href={content.psi.url} disclosure={content.externalDisclosure}>
          {content.psi.source}
        </MeasuredLink>
        {MEASURED_FIELD_SEPARATOR}
        <MeasuredLink href={content.ask.url} disclosure={content.externalDisclosure}>
          {content.ask.source}
        </MeasuredLink>
        {CACHE_KEY_OPEN}
        {content.ask.cacheKey}
        {CACHE_KEY_CLOSE}
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
