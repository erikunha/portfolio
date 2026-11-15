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

export async function sendContactMessage(
  msgId: string,
  message: ContactMessage,
  requestId: string,
): Promise<boolean> {
  try {
    if (!env.RESEND_API_KEY) {
      log.error('contact delivery unavailable', { requestId, msgId });
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
      log.error('contact delivery rejected', { requestId, msgId });
      return false;
    }
    return true;
  } catch {
    log.error('contact delivery unavailable', { requestId, msgId });
    return false;
  }
}
