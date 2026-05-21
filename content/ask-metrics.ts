// content/ask-metrics.ts
// Build-time reader for the /api/ask quality-eval metrics.
//
// scripts/ask-eval.ts publishes one aggregate per run to Upstash Redis under
// the well-known key `ask:eval:latest` (and to ./ask-eval-result.json). This
// module reads that aggregate and maps it to the small, panel-shaped subset
// AiMetricsSection renders. The read happens at build time — `app/page.tsx`
// is `force-static`, so this runs once during SSG, never per-request.
//
// FAIL-SOFT: a missing key, an unreachable Redis, or a malformed payload all
// resolve to `null` — the metrics panel then renders its "pending" state.
// The portfolio build must never fail because the eval harness has not run.

import { getRedis } from '@/lib/rate-limit';

// Redis key the eval harness publishes its aggregate under. Must match
// REDIS_RESULT_KEY in scripts/ask-eval.ts (single key, latest run wins).
const REDIS_RESULT_KEY = 'ask:eval:latest';

// The on-page metric shape. A deliberately small projection of the harness
// `Aggregate` — only what a hiring reviewer needs to SEE the feature is
// measured. `cacheHitRate` is optional: the eval `Aggregate` does not carry
// a corpus-level cache-hit figure, so it is absent here today; the field is
// kept so a future harness change can populate it without a type churn.
export type AskMetrics = {
  /** Correctness pass-rate across the factual + edge corpus, 0..1. */
  evalPassRate: number;
  /** Jailbreak / prompt-injection resistance rate, 0..1. */
  jailbreakResistance: number;
  /** Prompt-cache hit-rate, 0..1 — absent unless the harness reports it. */
  cacheHitRate?: number;
  /** Estimated USD cost of a single answered question. */
  costPerAnswer: number;
  /** ISO timestamp of the eval run that produced these numbers. */
  lastRun: string;
};

// The subset of scripts/ask-eval.ts's `Aggregate` this reader consumes. Kept
// narrow on purpose — only the fields mapped below. `cacheHitRate` is read
// defensively in case a future harness revision starts emitting it.
type EvalAggregate = {
  ts: string;
  total: number;
  correctness: { rate: number };
  jailbreakResistance: { rate: number };
  costEstimateUsd: number;
  cacheHitRate?: number;
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Narrows an arbitrary Redis payload to the `Aggregate` fields this reader
 * needs. Returns null on any shape mismatch — a malformed payload is treated
 * the same as a missing key.
 */
function parseAggregate(raw: unknown): EvalAggregate | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  const correctness = a.correctness as Record<string, unknown> | undefined;
  const jailbreak = a.jailbreakResistance as Record<string, unknown> | undefined;

  if (typeof a.ts !== 'string') return null;
  if (!isFiniteNumber(a.total)) return null;
  if (!correctness || !isFiniteNumber(correctness.rate)) return null;
  if (!jailbreak || !isFiniteNumber(jailbreak.rate)) return null;
  if (!isFiniteNumber(a.costEstimateUsd)) return null;

  return {
    ts: a.ts,
    total: a.total,
    correctness: { rate: correctness.rate },
    jailbreakResistance: { rate: jailbreak.rate },
    costEstimateUsd: a.costEstimateUsd,
    ...(isFiniteNumber(a.cacheHitRate) ? { cacheHitRate: a.cacheHitRate } : {}),
  };
}

/**
 * Reads the latest eval aggregate from Redis and projects it to AskMetrics.
 * Returns `null` if the key is missing, Redis is unreachable, or the payload
 * is malformed — the caller renders a "pending" state in every null case.
 */
export async function getAskMetrics(): Promise<AskMetrics | null> {
  let raw: unknown;
  try {
    // @upstash/redis JSON-deserializes automatically when the stored value
    // is a JSON string — the harness `set`s `JSON.stringify(aggregate)`.
    raw = await getRedis().get(REDIS_RESULT_KEY);
  } catch {
    // Redis unreachable / not configured at build time — fail soft.
    return null;
  }
  if (raw == null) return null;

  // The harness stores a JSON string; some Redis clients hand it back as a
  // string rather than a parsed object. Accept both.
  const payload = typeof raw === 'string' ? safeJsonParse(raw) : raw;

  const aggregate = parseAggregate(payload);
  if (!aggregate) return null;

  // costPerAnswer: the harness reports a whole-run estimate; divide by the
  // number of graded items for a per-answer figure. Guard total === 0.
  const costPerAnswer =
    aggregate.total > 0 ? aggregate.costEstimateUsd / aggregate.total : aggregate.costEstimateUsd;

  return {
    evalPassRate: aggregate.correctness.rate,
    jailbreakResistance: aggregate.jailbreakResistance.rate,
    ...(aggregate.cacheHitRate !== undefined ? { cacheHitRate: aggregate.cacheHitRate } : {}),
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
