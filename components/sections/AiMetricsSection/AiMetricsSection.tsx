import { Suspense } from 'react';
import type { AskMetrics } from '@/content/ask-metrics';
import { getAskMetrics } from '@/content/ask-metrics';
import { TerminalPanel } from '@/design-system';
import { IconAiMetrics } from '../../Icons';
import { Module } from '../../responsive/Module';

const pct = (rate: number): string => `${Math.round(rate * 100)}%`;

const usd = (n: number): string => `$${n.toFixed(4)}`;

const ms = (n: number): string => `${Math.round(n)}ms`;

function lastRunLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toUTCString().replace(':00 GMT', ' UTC');
}

function AiMetricsPending() {
  return (
    <div className="font-mono">
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
      <div className="grid grid-cols-4 gap-[14px] max-[900px]:grid-cols-2 max-[900px]:gap-3">
        <TerminalPanel className="p-4 pb-[18px] flex flex-col gap-2" data-metric>
          <div className="text-tertiary-50 text-xs max-md:text-[10px] tracking-[0.16em]">
            EVAL PASS-RATE
          </div>
          <div className="text-primary-500 font-bold text-2xl leading-none tracking-[0.01em] max-[900px]:text-xl max-md:text-2xl">
            {pct(metrics.evalPassRate)}
          </div>
          <div className="text-primary-400 text-sm max-md:text-xs leading-[1.5] mt-auto">
            correctness · factual + edge corpus
          </div>
        </TerminalPanel>
        <TerminalPanel className="p-4 pb-[18px] flex flex-col gap-2" data-metric>
          <div className="text-tertiary-50 text-xs max-md:text-[10px] tracking-[0.16em]">
            JAILBREAK RESIST
          </div>
          <div className="text-primary-500 font-bold text-2xl leading-none tracking-[0.01em] max-[900px]:text-xl max-md:text-2xl">
            {pct(metrics.jailbreakResistance)}
          </div>
          <div className="text-primary-400 md:text-primary-500 text-sm max-md:text-xs leading-[1.5] mt-auto">
            prompt-injection refusal rate
          </div>
        </TerminalPanel>
        <TerminalPanel className="p-4 pb-[18px] flex flex-col gap-2" data-metric>
          <div className="text-tertiary-50 text-xs max-md:text-[10px] tracking-[0.16em]">
            P95 LATENCY
          </div>
          <div className="text-primary-500 font-bold text-2xl leading-none tracking-[0.01em] max-[900px]:text-xl max-md:text-2xl">
            {ms(metrics.p95LatencyMs)}
          </div>
          <div className="text-primary-400 text-sm max-md:text-xs leading-[1.5] mt-auto">
            end-to-end · slowest 5% of answers
          </div>
        </TerminalPanel>
        <TerminalPanel className="p-4 pb-[18px] flex flex-col gap-2" data-metric>
          <div className="text-tertiary-50 text-xs max-md:text-[10px] tracking-[0.16em]">
            COST / ANSWER
          </div>
          <div className="text-primary-500 font-bold text-2xl leading-none tracking-[0.01em] max-[900px]:text-xl max-md:text-2xl">
            {usd(metrics.costPerAnswer)}
          </div>
          <div className="text-primary-400 text-sm max-md:text-xs leading-[1.5] mt-auto">
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
