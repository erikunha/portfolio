import { Suspense } from 'react';
import { getScores, LIGHTHOUSE_FALLBACK, type LighthouseScores } from '@/lib/lighthouse-scores';
import { IconLivePerf } from '../Icons';
import { Module } from '../responsive/Module';

async function PerfData() {
  const scores = await getScores().catch(() => LIGHTHOUSE_FALLBACK);
  return <PerfBody scores={scores} />;
}

function PerfBody({ scores }: { scores: LighthouseScores }) {
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
    <div className="perf">
      <div className="perf-row">
        {cells.map((s) => (
          <div key={s.label} className="perf-cell">
            <div className="pk">{s.label}</div>
            <div className="pv">
              {isFallback ? '—' : s.value}
              <span className="of">/100</span>
            </div>
            <div className="pbar">
              <i style={{ width: isFallback ? '0%' : `${s.value}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="perf-foot">
        <span>
          <span className="live-dot" />
          {isFallback ? 'SOURCE: PSI API unavailable' : 'SOURCE: PageSpeed Insights · cached daily'}
        </span>
        <span>LAST_CHECK: {lastCheck}</span>
      </div>
    </div>
  );
}

function PerfFallback() {
  return (
    <div className="perf" aria-busy="true" style={{ opacity: 0.4 }}>
      <div className="perf-row">
        {['PERFORMANCE', 'ACCESSIBILITY', 'BEST PRACTICES', 'SEO'].map((label) => (
          <div key={label} className="perf-cell">
            <div className="pk">{label}</div>
            <div className="pv">
              —<span className="of">/100</span>
            </div>
            <div className="pbar">
              <i style={{ width: '0%' }} />
            </div>
          </div>
        ))}
      </div>
      <div className="perf-foot">
        <span>
          <span className="live-dot" />
          loading...
        </span>
      </div>
    </div>
  );
}

export function LivePerfSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-live-perf"
      header="LIVE_PERF.JSON"
      mobileHeader="LIVE_PERF · LIGHTHOUSE"
      icon={<IconLivePerf />}
      defer={defer}
    >
      <Suspense fallback={<PerfFallback />}>
        <PerfData />
      </Suspense>
    </Module>
  );
}
