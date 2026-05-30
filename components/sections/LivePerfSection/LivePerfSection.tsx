import { Suspense } from 'react';
import { getScores, LIGHTHOUSE_FALLBACK, type LighthouseScores } from '@/lib/lighthouse-scores';
import { IconLivePerf } from '../../Icons';
import { Module } from '../../responsive/Module';
import styles from './LivePerfSection.module.css';

export async function PerfData() {
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
    <div>
      <div className={styles.root}>
        {cells.map((s) => (
          <div key={s.label} className={styles.cell}>
            <div className={styles.pk}>{s.label}</div>
            <div className={styles.pv}>
              {isFallback ? '—' : s.value}
              <span className={styles.of}>/100</span>
            </div>
            <div className={styles.pbar}>
              <i style={{ width: isFallback ? '0%' : `${s.value}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className={styles.foot}>
        <span>
          <span className={styles.liveDot} />
          {isFallback ? 'SOURCE: PSI API unavailable' : 'SOURCE: PageSpeed Insights · cached daily'}
        </span>
        <span>LAST_CHECK: {lastCheck}</span>
      </div>
    </div>
  );
}

function PerfFallback() {
  return (
    <div aria-busy="true" style={{ opacity: 0.4 }}>
      <div className={styles.root}>
        {['PERFORMANCE', 'ACCESSIBILITY', 'BEST PRACTICES', 'SEO'].map((label) => (
          <div key={label} className={styles.cell}>
            <div className={styles.pk}>{label}</div>
            <div className={styles.pv}>
              —<span className={styles.of}>/100</span>
            </div>
            <div className={styles.pbar}>
              <i style={{ width: '0%' }} />
            </div>
          </div>
        ))}
      </div>
      <div className={styles.foot}>
        <span>
          <span className={styles.liveDot} />
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
      variant="green"
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
