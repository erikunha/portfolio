import 'server-only';

import { parseConversationId } from '@/lib/ask/conversation-id';
import type { AskFailureReason } from '@/lib/ask/failure-reason';
import type { PostHocVerdict } from '@/lib/ask/output-guard';
import { redactPii } from '@/lib/ask/redact-pii';
import { log } from '@/lib/log';
import { describeError } from '@/lib/log-error';
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

const ASK_LOG_KEY_PATTERN = /^ask:log:\d{4}-\d{2}-\d{2}:[0-9a-f-]{36}$/;

const FORGOTTEN_TTL_S = 10 * 60;

export function askForgottenKey(id: string): string {
  return `ask:forgotten:${id}`;
}

export async function markForgotten(ids: readonly string[]): Promise<void> {
  const redis = getRedis();
  await Promise.all(ids.map((id) => redis.set(askForgottenKey(id), 1, { ex: FORGOTTEN_TTL_S })));
}

async function wasForgotten(ids: readonly string[]): Promise<boolean> {
  try {
    const redis = getRedis();
    const marks = await Promise.all(ids.map((id) => redis.get(askForgottenKey(id))));
    return marks.some((mark) => mark !== null && mark !== undefined);
  } catch {
    return false;
  }
}

export function askConversationKey(conversationId: string): string {
  return `ask:conv:${conversationId}`;
}

export function isAskLogKey(key: unknown): key is string {
  return typeof key === 'string' && ASK_LOG_KEY_PATTERN.test(key);
}

function decodeStored(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function storedConversationId(values: readonly unknown[]): string | null {
  for (const value of values) {
    const decoded = decodeStored(value);
    if (typeof decoded !== 'object' || decoded === null) continue;
    const conversationId = parseConversationId(
      (decoded as { conversationId?: unknown }).conversationId,
    );
    if (conversationId !== null) return conversationId;
  }
  return null;
}

export function askLogDatesInTtl(now: Date): string[] {
  const dayCount = Math.ceil(ASK_KV_TTL_S / SECONDS_PER_DAY) + 1;
  return Array.from({ length: dayCount }, (_unused, daysAgo) =>
    new Date(now.getTime() - daysAgo * MS_PER_DAY).toISOString().slice(0, ISO_DATE_LENGTH),
  );
}

export type AskInteractionStatus = 'completed' | 'errored' | 'aborted' | 'refused';

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
  reason?: AskFailureReason;
  guard?: PostHocVerdict;
  conversationId?: string;
};

export async function persistAskInteraction(interaction: AskInteraction): Promise<void> {
  const today = interaction.ts.slice(0, ISO_DATE_LENGTH);
  const key = askLogKey(today, interaction.requestId);
  const record = {
    ...interaction,
    question: redactPii(interaction.question).slice(0, LOGGED_QUESTION_CHARS),
    answer: redactPii(interaction.answer).slice(0, LOGGED_ANSWER_CHARS),
  };
  const { conversationId } = interaction;
  try {
    if (conversationId === undefined) {
      await getRedis().set(key, JSON.stringify(record), { ex: ASK_KV_TTL_S });
    } else {
      const index = askConversationKey(conversationId);
      const tx = getRedis().multi();
      tx.set(key, JSON.stringify(record), { ex: ASK_KV_TTL_S });
      tx.sadd(index, key);
      tx.expire(index, ASK_KV_TTL_S);
      await tx.exec();
    }
    const marks =
      conversationId === undefined
        ? [interaction.requestId]
        : [interaction.requestId, conversationId];
    if (await wasForgotten(marks)) {
      const redis = getRedis();
      await redis.del(key);
      if (conversationId !== undefined) await redis.srem(askConversationKey(conversationId), key);
    }
  } catch (err) {
    log.error('ask-log KV write failed', {
      requestId: interaction.requestId,
      error: describeError(err),
    });
  }
}
