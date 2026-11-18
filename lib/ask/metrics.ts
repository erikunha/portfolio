import { ASK_EVAL_RESULT_KEY } from '@/lib/eval/result-key';
import { getRedis } from '@/lib/redis';
import { withTimeout } from '@/lib/with-timeout';

export type AskMetrics = {
  evalPassRate: number;
  jailbreakResistance: number;
  p95LatencyMs: number;
  costPerAnswer: number;
  lastRun: string;
  featureModel?: string;
};

type EvalAggregate = {
  ts: string;
  featureModel?: string;
  total: number;
  answeredCount: number;
  correctness: { rate: number };
  jailbreakResistance: { rate: number };
  latencyMs: { p95: number };
  featureCostUsd: number;
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function parseAggregate(raw: unknown): EvalAggregate | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const correctness = a.correctness as Record<string, unknown> | undefined;
  const jailbreak = a.jailbreakResistance as Record<string, unknown> | undefined;
  const latency = a.latencyMs as Record<string, unknown> | undefined;

  if (typeof a.ts !== 'string') return null;
  if (!isFiniteNumber(a.total)) return null;
  if (!isFiniteNumber(a.answeredCount)) return null;
  if (!correctness || !isFiniteNumber(correctness.rate)) return null;
  if (!jailbreak || !isFiniteNumber(jailbreak.rate)) return null;
  if (!latency || !isFiniteNumber(latency.p95)) return null;
  if (!isFiniteNumber(a.featureCostUsd)) return null;

  return {
    ts: a.ts,
    ...(typeof a.featureModel === 'string' ? { featureModel: a.featureModel } : {}),
    total: a.total,
    answeredCount: a.answeredCount,
    correctness: { rate: correctness.rate },
    jailbreakResistance: { rate: jailbreak.rate },
    latencyMs: { p95: latency.p95 },
    featureCostUsd: a.featureCostUsd,
  };
}

export function parseAskMetrics(raw: unknown): AskMetrics | null {
  const payload = typeof raw === 'string' ? safeJsonParse(raw) : raw;

  const aggregate = parseAggregate(payload);
  if (!aggregate) return null;

  const costPerAnswer =
    aggregate.answeredCount > 0
      ? aggregate.featureCostUsd / aggregate.answeredCount
      : aggregate.featureCostUsd;

  return {
    evalPassRate: aggregate.correctness.rate,
    jailbreakResistance: aggregate.jailbreakResistance.rate,
    p95LatencyMs: aggregate.latencyMs.p95,
    costPerAnswer,
    lastRun: aggregate.ts,
    ...(aggregate.featureModel === undefined ? {} : { featureModel: aggregate.featureModel }),
  };
}

export async function getAskMetrics(): Promise<AskMetrics | null> {
  const raw: unknown = await withTimeout(() => getRedis().get(ASK_EVAL_RESULT_KEY));
  if (raw == null) return null;
  return parseAskMetrics(raw);
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
