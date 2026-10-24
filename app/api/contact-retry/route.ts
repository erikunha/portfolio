import type { NextRequest } from 'next/server';
import { sendContactMessage, sendContactRetryAlert } from '@/lib/contact-delivery';
import {
  CONTACT_MAX_RETRY_AGE_MS,
  CONTACT_MAX_RETRY_ATTEMPTS,
  getContactAttempts,
  getContactMessage,
  getPendingContactIds,
  incrementContactAttempts,
  removePendingContact,
} from '@/lib/contact-outbox';
import { env } from '@/lib/env';
import { log } from '@/lib/log';

const AUTHORIZATION_HEADER = 'authorization';
const UNAUTHORIZED_STATUS = 401;
const RETRY_LOOP_BUDGET_MS = 50_000;

export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<Response> {
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret || req.headers.get(AUTHORIZATION_HEADER) !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: UNAUTHORIZED_STATUS });
  }

  const retryDeadline = Date.now() + RETRY_LOOP_BUDGET_MS;
  const requestId = crypto.randomUUID();
  const counts = { sent: 0, failed: 0, expired: 0, exhausted: 0 };
  const droppedIds: string[] = [];
  try {
    const pendingIds = await getPendingContactIds();

    for (const msgId of pendingIds) {
      if (Date.now() >= retryDeadline) break;
      try {
        const message = await getContactMessage(msgId);
        if (!message || Date.now() - Date.parse(message.receivedAt) > CONTACT_MAX_RETRY_AGE_MS) {
          await removePendingContact(msgId);
          counts.expired++;
          droppedIds.push(msgId);
          log.error('contact retry dropped', { requestId, msgId });
          continue;
        }
        if ((await getContactAttempts(msgId)) >= CONTACT_MAX_RETRY_ATTEMPTS) {
          await removePendingContact(msgId);
          counts.exhausted++;
          droppedIds.push(msgId);
          log.error('contact retry dropped', { requestId, msgId });
          continue;
        }
        if (Date.now() >= retryDeadline) break;
        const attempts = await incrementContactAttempts(msgId);
        if (attempts === null) continue;
        if (attempts > CONTACT_MAX_RETRY_ATTEMPTS) {
          await removePendingContact(msgId);
          counts.exhausted++;
          droppedIds.push(msgId);
          log.error('contact retry dropped', { requestId, msgId });
          continue;
        }
        if (await sendContactMessage(msgId, message, requestId, retryDeadline)) {
          await removePendingContact(msgId);
          counts.sent++;
        } else {
          counts.failed++;
        }
      } catch {
        log.error('contact retry failed', { requestId, msgId });
        counts.failed++;
      }
    }
  } finally {
    log.info('contact retry completed', { requestId, ...counts });
  }
  if (droppedIds.length) await sendContactRetryAlert(droppedIds, requestId);
  return Response.json(counts);
}
