// components/sections/AiMetricsSection.tsx
// Pure Server Component — no 'use client', no client JS. Surfaces the
// /api/ask quality-eval metrics published by scripts/ask-eval.ts so a hiring
// reviewer can SEE the AI feature is measured, not just claimed.
//
// getAskMetrics() reads Redis per-request under cacheComponents/dynamicIO.
// The async RSC is wrapped in <Suspense> so the static PPR shell prerenders
// without blocking on Redis. On a null result — key missing, Redis unreachable,
// harness never run — the panel renders a minimal "pending" state.

import { Suspense } from 'react';
import type { AskMetrics } from '@/content/ask-metrics';
import { getAskMetrics } from '@/content/ask-metrics';
import { IconAiMetrics } from '../Icons';
import { Module } from '../responsive/Module';
import styles from './AiMetricsSection.module.css';

const pct = (rate: number): string => `${Math.round(rate * 100)}%`;

// Cost is a sub-cent figure; 4 decimal places keeps it readable without
// rounding a real estimate down to "$0.00".
const usd = (n: number): string => `$${n.toFixed(4)}`;

// Latency reads as whole milliseconds — sub-ms precision is noise here.
const ms = (n: number): string => `${Math.round(n)}ms`;

function lastRunLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toUTCString().replace(':00 GMT', ' UTC');
}

function AiMetricsPending() {
  return (
    <div className={styles.root}>
      <p className={styles.pending}>
        <span className={styles.gt}>{'>'}</span>
        eval pending — run <code>pnpm ask:eval</code> to publish the latest aggregate
      </p>
    </div>
  );
}

function AiMetricsBody({ metrics }: { metrics: AskMetrics | null }) {
  if (metrics === null) return <AiMetricsPending />;

  return (
    <div className={styles.root}>
      <div className={styles.grid}>
        <div className={styles.metric}>
          <div className={styles.label}>EVAL PASS-RATE</div>
          <div className={styles.value}>{pct(metrics.evalPassRate)}</div>
          <div className={styles.note}>correctness · factual + edge corpus</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.label}>JAILBREAK RESIST</div>
          <div className={styles.value}>{pct(metrics.jailbreakResistance)}</div>
          <div className={styles.note}>prompt-injection refusal rate</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.label}>P95 LATENCY</div>
          <div className={styles.value}>{ms(metrics.p95LatencyMs)}</div>
          <div className={styles.note}>end-to-end · slowest 5% of answers</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.label}>COST / ANSWER</div>
          <div className={styles.value}>{usd(metrics.costPerAnswer)}</div>
          <div className={styles.note}>production inference · feature model only</div>
        </div>
      </div>
      <div className={styles.foot}>
        <span>
          <span className={styles.gt}>{'>'}</span>
          SOURCE: scripts/ask-eval.ts · ask:eval:latest
        </span>
        <span>
          LAST_RUN: <time dateTime={metrics.lastRun}>{lastRunLabel(metrics.lastRun)}</time>
        </span>
      </div>
    </div>
  );
}

// Exported for unit testing — the async inner RSC that fetches and renders data.
// AiMetricsSection (the Suspense wrapper) is what page.tsx renders.
export async function AiMetricsData() {
  const metrics = await getAskMetrics();
  return <AiMetricsBody metrics={metrics} />;
}

export function AiMetricsSection({ defer }: { defer?: boolean } = {}) {
  return (
    <Module
      id="sec-ai-metrics"
      header="ASK_EVAL.JSON --MEASURED"
      mobileHeader="ASK_EVAL.JSON"
      icon={<IconAiMetrics />}
      defer={defer}
    >
      <Suspense fallback={<AiMetricsPending />}>
        <AiMetricsData />
      </Suspense>
    </Module>
  );
}
