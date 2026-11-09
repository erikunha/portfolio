import { connection } from 'next/server';
import { type ReactNode, Suspense } from 'react';
import { ExternalLink } from '@/components/ExternalLink';
import { measured as measuredContent, measuredStates, metricTimestamp } from '@/content/measured';
import { STALE_AGE_TOKEN, STALE_TIME_TOKEN } from '@/content/measured-states.schema';
import type { SiteLocale } from '@/content/site-locale';
import { asciiBar } from '@/lib/ascii-bar';
import {
  getScores,
  LIGHTHOUSE_FALLBACK,
  LIGHTHOUSE_TTL_S,
  type LighthouseScores,
  type Strategy,
} from '@/lib/lighthouse-scores';
import { HOURS_PER_DAY, MS_PER_HOUR, pad2 } from '@/lib/time';
import vercelConfig from '@/vercel.json';
import { MeasuredStatus } from '../MeasuredStatus';

type ScoresByStrategy = Partial<Record<Strategy, LighthouseScores | null>>;

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
  reserve,
  placeholder,
  unavailable,
}: {
  label: string;
  value: ReactNode;
  description: ReactNode;
  reserve?: string;
  placeholder?: boolean;
  unavailable?: boolean;
}) {
  return (
    <div
      className="measured-tile"
      data-metric
      data-placeholder={placeholder || unavailable || undefined}
      data-unavailable={unavailable || undefined}
    >
      <div className="measured-label" data-reserve={reserve}>
        {reserve === undefined || reserve === '' ? label : <span>{label}</span>}
      </div>
      <div className="measured-value">{value}</div>
      <div className="measured-description">{description}</div>
    </div>
  );
}

const PSI_REFRESH_PATH = '/api/psi-refresh';
const DAYS_SHOWN_FROM_HOURS = 48;
const CLOCK_SEPARATOR = ':';

function refreshTimeUtc(): string {
  const cron = vercelConfig.crons.find((entry) => entry.path === PSI_REFRESH_PATH);
  if (!cron) throw new Error(`vercel.json has no cron for ${PSI_REFRESH_PATH}`);
  const [minute = '', hour = ''] = cron.schedule.split(' ');
  return [hour, minute].map(pad2).join(CLOCK_SEPARATOR);
}

const STALE_RESERVE_DAYS = 99;
const STALE_RESERVE_TIME = '00:00';

function staleNote(locale: SiteLocale, fetchedAt: string): string {
  const { perfStale } = measuredStates[locale];
  const hours = Math.max(0, Math.floor((Date.now() - Date.parse(fetchedAt)) / MS_PER_HOUR));
  const age =
    hours >= DAYS_SHOWN_FROM_HOURS
      ? `${Math.floor(hours / HOURS_PER_DAY)}${perfStale.dayUnit}`
      : `${hours}${perfStale.hourUnit}`;
  return perfStale.note.replace(STALE_AGE_TOKEN, age).replace(STALE_TIME_TOKEN, refreshTimeUtc());
}

const unavailableNote = (locale: SiteLocale) =>
  measuredStates[locale].perfUnavailable.note.replace(STALE_TIME_TOKEN, refreshTimeUtc());

const staleReserve = (locale: SiteLocale) => {
  const { perfStale } = measuredStates[locale];
  return perfStale.note
    .replace(STALE_AGE_TOKEN, `${STALE_RESERVE_DAYS}${perfStale.dayUnit}`)
    .replace(STALE_TIME_TOKEN, STALE_RESERVE_TIME);
};

const isAvailable = (scores: LighthouseScores | null | undefined): scores is LighthouseScores =>
  Boolean(scores) && scores?.fetchedAt !== LIGHTHOUSE_FALLBACK.fetchedAt;

const oldestFetchedAt = (available: LighthouseScores[]) =>
  available
    .map((scores) => scores.fetchedAt)
    .reduce((a, b) => (Date.parse(b) < Date.parse(a) ? b : a));

export async function PerfData({ locale }: { locale: SiteLocale }) {
  await connection();
  const strategies = measuredContent[locale].psi.strategies;
  const results = await Promise.all(
    strategies.map((strategy) => getScores(strategy.key).catch(() => null)),
  );
  const scores: ScoresByStrategy = {};
  strategies.forEach((strategy, index) => {
    scores[strategy.key] = results[index] ?? null;
  });
  return <PerfBody locale={locale} scores={scores} />;
}

type Measured = (typeof measuredContent)[SiteLocale];

function perfStatusMessage(
  measured: Measured,
  state: {
    unavailable: boolean;
    staleSince: string | null;
    locale: SiteLocale;
    showTimestamp: boolean;
    timestamp: ReturnType<typeof metricTimestamp>;
  },
) {
  if (state.unavailable) return unavailableNote(state.locale);
  if (state.staleSince) return staleNote(state.locale, state.staleSince);
  return state.showTimestamp && !state.timestamp.valid ? measured.unknownTimestamp : null;
}

const LOAD_BAR_CELLS = 12;
const LOAD_BAR_HELD_CELLS = 4;
const LOAD_BAR_OPEN = '[';
const LOAD_BAR_CLOSE = ']';

const loadBar = (fraction: number) =>
  `${LOAD_BAR_OPEN}${asciiBar(fraction, LOAD_BAR_CELLS)}${LOAD_BAR_CLOSE}`;

const loadingLine = (locale: SiteLocale) =>
  `${measuredStates[locale].perfLoading.fetching} ${loadBar(0)}`;

const perfStatusReserve = (locale: SiteLocale, measured: Measured) => [
  loadingLine(locale),
  unavailableNote(locale),
  measured.unknownTimestamp,
  staleReserve(locale),
];

function PerfLoading({ locale }: { locale: SiteLocale }) {
  const measured = measuredContent[locale];
  const { perfLoading } = measuredStates[locale];
  const { psi } = measured;
  const placeholderPair = psi.strategies.map(() => perfLoading.placeholder).join(psi.pairSeparator);
  return (
    <div className="measured-perf" aria-busy="true">
      <h3 className="measured-heading">{perfLoading.label}</h3>
      <div className="measured-tiles">
        {psi.metrics.map((metric) => (
          <MeasuredTile
            key={metric.key}
            label={perfLoading.tiles[metric.key]}
            reserve={metric.label}
            value={placeholderPair}
            description={psi.strategies.map((strategy) => strategy.label).join(psi.pairSeparator)}
            placeholder
          />
        ))}
      </div>
      <MeasuredStatus
        message={
          <>
            {perfLoading.fetching}{' '}
            <span
              className="measured-load-bar"
              aria-hidden="true"
              data-track={loadBar(0)}
              data-fill={loadBar(1)}
            >
              {loadBar(LOAD_BAR_HELD_CELLS / LOAD_BAR_CELLS)}
            </span>
          </>
        }
        live
        reserve={perfStatusReserve(locale, measured)}
      />
    </div>
  );
}

function PerfBody({ locale, scores }: { locale: SiteLocale; scores: ScoresByStrategy | null }) {
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
  const showTimestamp = available.length > 0;
  const lastGood = available.filter((entry) => entry.stale);
  const staleSince = lastGood.length > 0 ? oldestFetchedAt(lastGood) : null;
  return (
    <div className="measured-perf">
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
        {showTimestamp && timestamp.stale && !staleSince ? (
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
            value={
              unavailable
                ? measured.unavailable
                : psi.strategies
                    .map((strategy) => {
                      const strategyScores = scores?.[strategy.key];
                      return isAvailable(strategyScores)
                        ? strategyScores[metric.key]
                        : format.empty;
                    })
                    .join(psi.pairSeparator)
            }
            description={psi.strategies.map((strategy) => strategy.label).join(psi.pairSeparator)}
            unavailable={unavailable}
          />
        ))}
      </div>
      <MeasuredStatus
        message={perfStatusMessage(measured, {
          unavailable,
          staleSince,
          locale,
          showTimestamp,
          timestamp,
        })}
        live
        reserve={perfStatusReserve(locale, measured)}
      />
    </div>
  );
}

export function LivePerfSection({ locale }: { locale: SiteLocale }) {
  return (
    <div id="sec-live-perf">
      <Suspense fallback={<PerfLoading locale={locale} />}>
        <PerfData locale={locale} />
      </Suspense>
    </div>
  );
}
