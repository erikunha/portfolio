import 'server-only';

import type { PostHocVerdict } from '@/lib/ask/output-guard';
import { log } from '@/lib/log';
import { getRedis } from '@/lib/rate-limit';

const ASK_KV_TTL_S = 90 * 24 * 60 * 60;

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
  guard?: PostHocVerdict;
};

export async function persistAskInteraction(interaction: AskInteraction): Promise<void> {
  const today = interaction.ts.slice(0, 10);
  const key = `ask:log:${today}:${interaction.requestId}`;
  const record = {
    ...interaction,
    question: interaction.question.slice(0, 500),
    answer: interaction.answer.slice(0, 1000),
  };
  try {
    await getRedis().set(key, JSON.stringify(record), { ex: ASK_KV_TTL_S });
  } catch (err) {
    log.error('ask-log KV write failed', { requestId: interaction.requestId, err });
  }
}
