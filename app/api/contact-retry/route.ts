import type { NextRequest } from 'next/server';
import { sendContactMessage } from '@/lib/contact-delivery';
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

export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<Response> {
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret || req.headers.get(AUTHORIZATION_HEADER) !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: UNAUTHORIZED_STATUS });
  }

  const requestId = crypto.randomUUID();
  const counts = { sent: 0, failed: 0, expired: 0, exhausted: 0 };
  const pendingIds = await getPendingContactIds();

  for (const msgId of pendingIds) {
    try {
      const message = await getContactMessage(msgId);
      if (!message || Date.now() - Date.parse(message.receivedAt) > CONTACT_MAX_RETRY_AGE_MS) {
        await removePendingContact(msgId);
        counts.expired++;
        continue;
      }
      if ((await getContactAttempts(msgId)) >= CONTACT_MAX_RETRY_ATTEMPTS) {
        await removePendingContact(msgId);
        counts.exhausted++;
        continue;
      }
      const attempts = await incrementContactAttempts(msgId);
      if (attempts > CONTACT_MAX_RETRY_ATTEMPTS) {
        await removePendingContact(msgId);
        counts.exhausted++;
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

  return Response.json(counts);
}
