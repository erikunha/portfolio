import 'server-only';

import type { PostHocVerdict } from '@/lib/ask/output-guard';
import { redactPii } from '@/lib/ask/redact-pii';
import { log } from '@/lib/log';
import { getRedis } from '@/lib/rate-limit';

const SECONDS_PER_DAY = 24 * 60 * 60;
const MS_PER_DAY = SECONDS_PER_DAY * 1000;
const ISO_DATE_LENGTH = 10;
const LOGGED_QUESTION_CHARS = 500;
const LOGGED_ANSWER_CHARS = 1000;
export const ASK_KV_TTL_S = 90 * SECONDS_PER_DAY;

export function askLogKey(date: string, requestId: string): string {
  return `ask:log:${date}:${requestId}`;
}

export function askLogDatesInTtl(now: Date): string[] {
  const dayCount = Math.ceil(ASK_KV_TTL_S / SECONDS_PER_DAY) + 1;
  return Array.from({ length: dayCount }, (_unused, daysAgo) =>
    new Date(now.getTime() - daysAgo * MS_PER_DAY).toISOString().slice(0, ISO_DATE_LENGTH),
  );
}

export type AskInteractionStatus = 'completed' | 'errored' | 'aborted';

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
  const today = interaction.ts.slice(0, ISO_DATE_LENGTH);
  const key = askLogKey(today, interaction.requestId);
  const record = {
    ...interaction,
    question: redactPii(interaction.question).slice(0, LOGGED_QUESTION_CHARS),
    answer: redactPii(interaction.answer).slice(0, LOGGED_ANSWER_CHARS),
  };
  try {
    await getRedis().set(key, JSON.stringify(record), { ex: ASK_KV_TTL_S });
  } catch (err) {
    log.error('ask-log KV write failed', { requestId: interaction.requestId, err });
  }
}
