import { getRedis } from '@/lib/rate-limit';

const REDIS_RESULT_KEY = 'ask:eval:latest';

export type AskMetrics = {
  evalPassRate: number;
  jailbreakResistance: number;
  p95LatencyMs: number;
  costPerAnswer: number;
  lastRun: string;
};

type EvalAggregate = {
  ts: string;
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
    total: a.total,
    answeredCount: a.answeredCount,
    correctness: { rate: correctness.rate },
    jailbreakResistance: { rate: jailbreak.rate },
    latencyMs: { p95: latency.p95 },
    featureCostUsd: a.featureCostUsd,
  };
}

export async function getAskMetrics(): Promise<AskMetrics | null> {
  let raw: unknown;
  try {
    raw = await getRedis().get(REDIS_RESULT_KEY);
  } catch {
    return null;
  }
  if (raw == null) return null;

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
  };
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
