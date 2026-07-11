import { Suspense } from 'react';
import {
  getScores,
  LIGHTHOUSE_FALLBACK,
  type LighthouseScores,
  type Strategy,
} from '@/lib/lighthouse-scores';
import { IconLivePerf } from '../../Icons';
import { Module } from '../../responsive/Module';

export async function PerfData({ strategy }: { strategy: Strategy }) {
  const scores = await getScores(strategy).catch(() => LIGHTHOUSE_FALLBACK);
  return <PerfBody scores={scores} strategy={strategy} />;
}

function PerfBody({ scores, strategy }: { scores: LighthouseScores; strategy: Strategy }) {
  const isFallback = scores.fetchedAt === LIGHTHOUSE_FALLBACK.fetchedAt;
  const cells = [
    { label: 'PERFORMANCE', value: scores.performance },
    { label: 'ACCESSIBILITY', value: scores.accessibility },
    { label: 'BEST PRACTICES', value: scores.bestPractices },
    { label: 'SEO', value: scores.seo },
  ];

  const lastCheck =
    scores.fetchedAt && scores.fetchedAt !== '—'
      ? new Date(scores.fetchedAt).toUTCString().replace(':00 GMT', ' UTC')
      : '—';

  return (
    <div>
      <div className="grid grid-cols-2 min-[901px]:grid-cols-4 gap-[10px] md:gap-[18px]">
        {cells.map((s) => (
          <div key={s.label} className="text-left">
            <div className="text-tertiary-50 text-[13px] font-bold tracking-[0.16em] md:tracking-[0.14em]">
              {s.label}
            </div>
            <div className="text-primary-500 font-bold text-[24px] md:text-[32px] leading-none my-[6px] md:my-2 tracking-[0.01em]">
              {isFallback ? '—' : s.value}
              <span className="text-primary-400 font-normal text-xs md:text-xs ml-1">/100</span>
            </div>
            <div
              className="h-[3px] md:h-1 bg-[var(--color-primary-quiet)] relative overflow-hidden"
              role="progressbar"
              aria-valuenow={isFallback ? 0 : s.value}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${s.label}: ${isFallback ? 'unavailable' : `${s.value} out of 100`}`}
            >
              <i
                className="block h-full bg-primary-500"
                style={{ width: isFallback ? '0%' : `${s.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center mt-[18px] text-primary-400 text-xs max-md:text-[10px] tracking-[0.14em]">
        <span>
          <span className="live-dot" />
          {isFallback ? 'SOURCE: PSI API unavailable' : `SOURCE: PageSpeed Insights · ${strategy}`}
        </span>
        <span>LAST_CHECK: {lastCheck}</span>
      </div>
    </div>
  );
}

function StrategyFallback({ strategy }: { strategy: string }) {
  return (
    <div aria-busy="true">
      <div className="grid grid-cols-2 min-[901px]:grid-cols-4 gap-[10px] md:gap-[18px]">
        {['PERFORMANCE', 'ACCESSIBILITY', 'BEST PRACTICES', 'SEO'].map((label) => (
          <div key={label} className="text-left">
            <div className="text-tertiary-50 text-[13px] font-bold tracking-[0.16em] md:tracking-[0.14em]">
              {label}
            </div>
            <div className="text-primary-500 font-bold text-[24px] md:text-[32px] leading-none my-[6px] md:my-2 tracking-[0.01em]">
              —<span className="text-primary-400 font-normal text-xs md:text-xs ml-1">/100</span>
            </div>
            <div
              className="h-[3px] md:h-1 bg-[var(--color-primary-quiet)] relative overflow-hidden"
              role="progressbar"
              aria-valuenow={0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${label}: loading`}
            >
              <i className="block h-full bg-primary-500" style={{ width: '0%' }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center mt-[18px] text-primary-400 text-xs max-md:text-[10px] tracking-[0.14em]">
        <span>
          <span className="live-dot" />
          {strategy} · loading...
        </span>
      </div>
    </div>
  );
}

function PerfFallback() {
  return (
    <>
      <div className="strategy-block">
        <p className="text-primary-400 text-xs tracking-[0.18em] mb-[10px]">DESKTOP</p>
        <StrategyFallback strategy="desktop" />
      </div>
      <div className="strategy-block">
        <p className="text-primary-400 text-xs tracking-[0.18em] mb-[10px]">MOBILE</p>
        <StrategyFallback strategy="mobile" />
      </div>
    </>
  );
}

export function LivePerfSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-live-perf"
      header="LIVE_PERF.JSON"
      variant="green"
      mobileHeader="LIVE_PERF · LIGHTHOUSE"
      icon={<IconLivePerf />}
      defer={defer}
    >
      <Suspense fallback={<PerfFallback />}>
        <div className="strategy-block">
          <p className="text-primary-400 text-xs tracking-[0.18em] mb-[10px]">DESKTOP</p>
          <PerfData strategy="desktop" />
        </div>
        <div className="strategy-block">
          <p className="text-primary-400 text-xs tracking-[0.18em] mb-[10px]">MOBILE</p>
          <PerfData strategy="mobile" />
        </div>
      </Suspense>
    </Module>
  );
}
