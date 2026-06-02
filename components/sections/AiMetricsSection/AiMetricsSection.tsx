// components/sections/AiMetricsSection/AiMetricsSection.tsx
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
import { TerminalPanel } from '@/design-system';
import { IconAiMetrics } from '../../Icons';
import { Module } from '../../responsive/Module';

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
    <div className="font-mono">
      {/* min-height reserves resolved-state height so the Suspense fallback does not cause a
          layout shift when the 4-card grid streams in. Different heights for 4-col vs 2-col. */}
      <p className="text-primary-400 text-sm tracking-[0.04em] m-0 min-h-[160px] max-[900px]:min-h-[290px]">
        <span className="text-primary-500 mr-1.5">{'>'}</span>
        eval pending — run <code className="text-primary-500 font-mono">pnpm ask:eval</code> to
        publish the latest aggregate
      </p>
    </div>
  );
}

function AiMetricsBody({ metrics }: { metrics: AskMetrics | null }) {
  if (metrics === null) return <AiMetricsPending />;

  return (
    <div className="font-mono">
      {/* 4-col desktop, 2-col at ≤900px */}
      <div className="grid grid-cols-4 gap-[14px] max-[900px]:grid-cols-2 max-[900px]:gap-3">
        <TerminalPanel className="p-4 pb-[18px] flex flex-col gap-2" data-metric>
          <div className="text-primary-400 text-xs max-md:text-[10px] tracking-[0.16em]">
            EVAL PASS-RATE
          </div>
          <div className="text-primary-500 font-bold text-2xl leading-none tracking-[0.01em] max-[900px]:text-xl max-md:text-2xl">
            {pct(metrics.evalPassRate)}
          </div>
          <div className="text-secondary-200 text-sm max-md:text-xs leading-[1.5] mt-auto">
            correctness · factual + edge corpus
          </div>
        </TerminalPanel>
        <TerminalPanel className="p-4 pb-[18px] flex flex-col gap-2" data-metric>
          <div className="text-primary-400 text-xs max-md:text-[10px] tracking-[0.16em]">
            JAILBREAK RESIST
          </div>
          <div className="text-primary-500 font-bold text-2xl leading-none tracking-[0.01em] max-[900px]:text-xl max-md:text-2xl">
            {pct(metrics.jailbreakResistance)}
          </div>
          <div className="text-secondary-200 text-sm max-md:text-xs leading-[1.5] mt-auto">
            prompt-injection refusal rate
          </div>
        </TerminalPanel>
        <TerminalPanel className="p-4 pb-[18px] flex flex-col gap-2" data-metric>
          <div className="text-primary-400 text-xs max-md:text-[10px] tracking-[0.16em]">
            P95 LATENCY
          </div>
          <div className="text-primary-500 font-bold text-2xl leading-none tracking-[0.01em] max-[900px]:text-xl max-md:text-2xl">
            {ms(metrics.p95LatencyMs)}
          </div>
          <div className="text-secondary-200 text-sm max-md:text-xs leading-[1.5] mt-auto">
            end-to-end · slowest 5% of answers
          </div>
        </TerminalPanel>
        <TerminalPanel className="p-4 pb-[18px] flex flex-col gap-2" data-metric>
          <div className="text-primary-400 text-xs max-md:text-[10px] tracking-[0.16em]">
            COST / ANSWER
          </div>
          <div className="text-primary-500 font-bold text-2xl leading-none tracking-[0.01em] max-[900px]:text-xl max-md:text-2xl">
            {usd(metrics.costPerAnswer)}
          </div>
          <div className="text-secondary-200 text-sm max-md:text-xs leading-[1.5] mt-auto">
            production inference · feature model only
          </div>
        </TerminalPanel>
      </div>
      <div className="flex justify-between items-center mt-[18px] pt-3 border-t border-dashed border-primary-quiet text-primary-400 text-xs tracking-[0.06em] max-[768px]:flex-col max-[768px]:items-start max-[768px]:gap-1.5 max-[768px]:text-[10px]">
        <span>
          <span className="text-primary-500 mr-1.5">{'>'}</span>
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
      variant="green"
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
