import 'server-only';

import { Resend } from 'resend';
import { EMAIL_ADDRESS } from '@/content/social-urls';
import type { ContactMessage } from '@/lib/contact-outbox';
import { env } from '@/lib/env';
import { log } from '@/lib/log';

const CONTACT_FROM = 'contact@erikunha.dev';
const CONTACT_TO = EMAIL_ADDRESS;
const CONTACT_SUBJECT_PREFIX = '[portfolio] message from';
const RESEND_TIMEOUT_MS = 10_000;

let resend: Resend | undefined;

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
    resend ??= new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send(
      {
        from: CONTACT_FROM,
        to: CONTACT_TO,
        replyTo: message.email,
        subject: `${CONTACT_SUBJECT_PREFIX} ${message.name}`,
        text: `From: ${message.name} <${message.email}>\nRef: ${msgId}\n\n${message.message}`,
      },
      { idempotencyKey: `contact:${msgId}`, signal: AbortSignal.timeout(RESEND_TIMEOUT_MS) },
    );
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
