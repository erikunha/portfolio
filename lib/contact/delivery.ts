import 'server-only';

import { EMAIL_ADDRESS } from '@/content/social-urls';
import { env } from '@/lib/env';
import { log } from '@/lib/log';
import { sendMail } from '@/lib/mail';
import type { ContactMessage } from './outbox';

const CONTACT_FROM = 'contact@erikunha.dev';
const CONTACT_TO = EMAIL_ADDRESS;
const CONTACT_SUBJECT_PREFIX = '[portfolio] message from';
const RESEND_TIMEOUT_MS = 10_000;

const LOG_NOT_CONFIGURED = 'contact delivery not configured';
const LOG_REJECTED = 'contact delivery rejected';
const LOG_UNAVAILABLE = 'contact delivery unavailable';

interface ErrorDetail {
  errorName?: string;
  statusCode?: number;
}

function errorDetail(error: unknown): ErrorDetail {
  if (typeof error !== 'object' || error === null) return {};
  const { name, statusCode } = error as { name?: unknown; statusCode?: unknown };
  return {
    ...(typeof name === 'string' ? { errorName: name } : {}),
    ...(typeof statusCode === 'number' ? { statusCode } : {}),
  };
}

export async function sendContactMessage(
  msgId: string,
  message: ContactMessage,
  requestId: string,
): Promise<boolean> {
  try {
    if (!env.RESEND_API_KEY) {
      log.error(LOG_NOT_CONFIGURED, { requestId, msgId });
      return false;
    }
    const { error } = await sendMail({
      from: CONTACT_FROM,
      to: CONTACT_TO,
      replyTo: message.email,
      subject: `${CONTACT_SUBJECT_PREFIX} ${message.name}`,
      text: `From: ${message.name} <${message.email}>\nRef: ${msgId}\n\n${message.message}`,
      idempotencyKey: `contact:${msgId}`,
      timeoutMs: RESEND_TIMEOUT_MS,
    });
    if (error) {
      log.error(LOG_REJECTED, { requestId, msgId, ...errorDetail(error) });
      return false;
    }
    return true;
  } catch (thrown) {
    log.error(LOG_UNAVAILABLE, { requestId, msgId, ...errorDetail(thrown) });
    return false;
  }
}
