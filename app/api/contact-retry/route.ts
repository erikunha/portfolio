import type { NextRequest } from 'next/server';
import { sendContactMessage } from '@/lib/contact/delivery';
import {
  getContactAttempts,
  getContactMessage,
  getPendingContactIds,
  incrementContactAttempts,
  removePendingContact,
} from '@/lib/contact/outbox';
import { retryPendingContacts } from '@/lib/contact/retry';
import { log } from '@/lib/log';
import { requireCron } from '@/lib/server/cron-auth';
import { ok } from '@/lib/server/route';

export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<Response> {
  const denied = requireCron(req);
  if (denied) return denied;

  const requestId = crypto.randomUUID();
  const counts = await retryPendingContacts(Date.now, {
    requestId,
    getPendingIds: getPendingContactIds,
    getMessage: getContactMessage,
    getAttempts: getContactAttempts,
    incrementAttempts: incrementContactAttempts,
    removePending: removePendingContact,
    deliver: sendContactMessage,
    log,
  });

  return ok({ requestId, data: counts });
}
