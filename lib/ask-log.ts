// lib/ask-log.ts
// Persists /api/ask Q+A interactions to Upstash KV for 90-day retrospective
// audit + product learning. Privacy: IP hashed via existing lib/ip-hash.ts
// helper; question truncated at 500 chars + answer at 1000 chars to bound
// PII overflow from prompt-injection attempts. GDPR/LGPD right-of-erasure
// is provided by Phase 3d's /api/log/forget endpoint (Task 7).
//
// Spec ref: docs/superpowers/specs/2026-05-18-production-observability-design.md §7c

import 'server-only';

import type { PostHocVerdict } from '@/lib/ask/output-guard';
import { log } from '@/lib/log';
import { getRedis } from '@/lib/rate-limit';

const ASK_KV_TTL_S = 90 * 24 * 60 * 60; // 90 days = 7_776_000s

export type AskInteractionStatus =
  | 'completed'
  | 'errored'
  | 'rate-limited'
  | 'dedup-rejected'
  | 'budget-exhausted';

export type AskInteraction = {
  requestId: string;
  ts: string;
  ipHash: string;
  question: string;
  answer: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  status: AskInteractionStatus;
  // WS2: Layer-2 egress-guard verdict over the buffered answer. Optional and
  // additive — older records (and early-exit persists) omit it. Carried into
  // the 90-day KV audit as a Layer-2 signal. NOTE: this is NOT a complete leak
  // ledger — a Layer-1 abort deliberately does not buffer the offending chunk,
  // so a guard-aborted request can persist a `clean` Layer-2 verdict; the
  // Layer-1 reason lives in the `ask output-guard layer-1 abort` log line, not
  // here. Read this field as "Layer-2 post-hoc scan result," not "all leaks."
  guard?: PostHocVerdict;
};

export async function persistAskInteraction(interaction: AskInteraction): Promise<void> {
  const today = interaction.ts.slice(0, 10); // yyyy-mm-dd
  const key = `ask:log:${today}:${interaction.requestId}`;
  const record = {
    ...interaction,
    question: interaction.question.slice(0, 500),
    answer: interaction.answer.slice(0, 1000),
  };
  try {
    await getRedis().set(key, JSON.stringify(record), { ex: ASK_KV_TTL_S });
  } catch (err) {
    // Fail-quiet — observability outage MUST NOT block /api/ask responses.
    log.error('ask-log KV write failed', { requestId: interaction.requestId, err });
  }
}
