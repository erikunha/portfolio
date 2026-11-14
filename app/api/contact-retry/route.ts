import type { NextRequest } from 'next/server';
import { sendContactMessage } from '@/lib/contact-delivery';
import {
  CONTACT_MAX_RETRY_ATTEMPTS,
  getContactAttempts,
  getContactMessage,
  getPendingContactIds,
  incrementContactAttempts,
  isContactRetryExpired,
  removePendingContact,
} from '@/lib/contact-outbox';
import { env } from '@/lib/env';
import { log } from '@/lib/log';
import { isCronAuthorized } from '@/lib/server/cron-auth';
import { err, ok } from '@/lib/server/route';

const UNAUTHORIZED_STATUS = 401;
const DROP_REASON = { expired: 'expired', exhausted: 'exhausted' } as const;
type DropReason = (typeof DROP_REASON)[keyof typeof DROP_REASON];

const MAX_DURATION_MS = 60_000;
const SEND_TIMEOUT_MS = 10_000;
const SAFETY_MARGIN_MS = 10_000;
const RETRY_START_DEADLINE_MS = MAX_DURATION_MS - SEND_TIMEOUT_MS - SAFETY_MARGIN_MS;

export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<Response> {
  const cronSecret = env.CRON_SECRET;
  if (!isCronAuthorized(req, cronSecret)) {
    return err({
      requestId: crypto.randomUUID(),
      status: UNAUTHORIZED_STATUS,
      code: 'unauthorized',
      message: 'unauthorized',
    });
  }

  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const counts = { sent: 0, failed: 0, expired: 0, exhausted: 0 };
  const pendingIds = await getPendingContactIds();

  const drop = async (msgId: string, reason: DropReason) => {
    await removePendingContact(msgId);
    counts[reason]++;
    log.warn('contact retry dropped', { requestId, msgId, reason });
  };

  for (const [index, msgId] of pendingIds.entries()) {
    if (Date.now() - startedAt >= RETRY_START_DEADLINE_MS) {
      log.warn('contact retry deadline reached', {
        requestId,
        remaining: pendingIds.length - index,
      });
      break;
    }
    try {
      const message = await getContactMessage(msgId);
      if (!message || isContactRetryExpired(Date.parse(message.receivedAt), Date.now())) {
        await drop(msgId, DROP_REASON.expired);
        continue;
      }
      if (
        (await getContactAttempts(msgId)) >= CONTACT_MAX_RETRY_ATTEMPTS ||
        (await incrementContactAttempts(msgId)) > CONTACT_MAX_RETRY_ATTEMPTS
      ) {
        await drop(msgId, DROP_REASON.exhausted);
        continue;
      }
      if (await sendContactMessage(msgId, message, requestId)) {
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

  return ok({ requestId, data: counts });
}
