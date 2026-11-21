import { CONTACT_MAX_RETRY_ATTEMPTS, type ContactMessage, isContactRetryExpired } from './outbox';

const DROP_REASON = { expired: 'expired', exhausted: 'exhausted' } as const;
type DropReason = (typeof DROP_REASON)[keyof typeof DROP_REASON];

const MAX_DURATION_MS = 60_000;
const SEND_TIMEOUT_MS = 10_000;
const SAFETY_MARGIN_MS = 10_000;
const RETRY_START_DEADLINE_MS = MAX_DURATION_MS - SEND_TIMEOUT_MS - SAFETY_MARGIN_MS;

export interface RetryCounts {
  sent: number;
  failed: number;
  expired: number;
  exhausted: number;
}

export interface RetryDeps {
  requestId: string;
  getPendingIds: () => Promise<string[]>;
  getMessage: (msgId: string) => Promise<ContactMessage | null>;
  getAttempts: (msgId: string) => Promise<number>;
  incrementAttempts: (msgId: string) => Promise<number>;
  removePending: (msgId: string) => Promise<void>;
  deliver: (msgId: string, message: ContactMessage, requestId: string) => Promise<boolean>;
  log: {
    warn: (message: string, fields: Record<string, unknown>) => void;
    error: (message: string, fields: Record<string, unknown>) => void;
  };
}

export async function retryPendingContacts(
  now: () => number,
  deps: RetryDeps,
): Promise<RetryCounts> {
  const { requestId, log } = deps;
  const startedAt = now();
  const counts: RetryCounts = { sent: 0, failed: 0, expired: 0, exhausted: 0 };
  const pendingIds = await deps.getPendingIds();

  const drop = async (msgId: string, reason: DropReason) => {
    await deps.removePending(msgId);
    counts[reason]++;
    log.warn('contact retry dropped', { requestId, msgId, reason });
  };

  for (const [index, msgId] of pendingIds.entries()) {
    if (now() - startedAt >= RETRY_START_DEADLINE_MS) {
      log.warn('contact retry deadline reached', {
        requestId,
        remaining: pendingIds.length - index,
      });
      break;
    }
    try {
      const message = await deps.getMessage(msgId);
      if (!message || isContactRetryExpired(Date.parse(message.receivedAt), now())) {
        await drop(msgId, DROP_REASON.expired);
        continue;
      }
      if (
        (await deps.getAttempts(msgId)) >= CONTACT_MAX_RETRY_ATTEMPTS ||
        (await deps.incrementAttempts(msgId)) > CONTACT_MAX_RETRY_ATTEMPTS
      ) {
        await drop(msgId, DROP_REASON.exhausted);
        continue;
      }
      if (await deps.deliver(msgId, message, requestId)) {
        await deps.removePending(msgId);
        counts.sent++;
      } else {
        counts.failed++;
      }
    } catch {
      log.error('contact retry failed', { requestId, msgId });
      counts.failed++;
    }
  }

  return counts;
}
