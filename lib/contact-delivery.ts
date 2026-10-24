import 'server-only';

import { Resend } from 'resend';
import type { ContactMessage } from '@/lib/contact-outbox';
import { env } from '@/lib/env';
import { log } from '@/lib/log';

const CONTACT_FROM = 'contact@erikunha.dev';
const CONTACT_TO = 'erikhenriquealvescunha@gmail.com';
const CONTACT_SUBJECT_PREFIX = '[portfolio] message from';
const RESEND_TIMEOUT_MS = 10_000;
const RESEND_TIMEOUT_ERROR = 'contact delivery timeout';

let resend: Resend | undefined;

export async function sendContactMessage(
  msgId: string,
  message: ContactMessage,
  requestId: string,
): Promise<boolean> {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  try {
    if (!env.RESEND_API_KEY) {
      log.error('contact delivery unavailable', { requestId, msgId });
      return false;
    }
    resend ??= new Resend(env.RESEND_API_KEY);
    const sendPromise = resend.emails.send(
      {
        from: CONTACT_FROM,
        to: CONTACT_TO,
        replyTo: message.email,
        subject: `${CONTACT_SUBJECT_PREFIX} ${message.name}`,
        text: `From: ${message.name} <${message.email}>\nRef: ${msgId}\n\n${message.message}`,
      },
      { idempotencyKey: `contact:${msgId}` },
    );
    const timeout = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => reject(new Error(RESEND_TIMEOUT_ERROR)), RESEND_TIMEOUT_MS);
    });
    const { error } = await Promise.race([sendPromise, timeout]);
    if (error) {
      log.error('contact delivery rejected', { requestId, msgId });
      return false;
    }
    return true;
  } catch {
    log.error('contact delivery unavailable', { requestId, msgId });
    return false;
  } finally {
    if (timerId !== undefined) clearTimeout(timerId);
  }
}
