import 'server-only';

import { Resend } from 'resend';
import { contactRetryAlertContent } from '@/content/contact';
import type { ContactMessage } from '@/lib/contact-outbox';
import { env } from '@/lib/env';
import { log } from '@/lib/log';

const ALERT_FROM = 'alerts@erikunha.dev';
const ALERT_TIMEOUT_MS = 5_000;
const ALERT_TIMEOUT_ERROR = 'contact retry alert timeout';
const CONTACT_FROM = 'contact@erikunha.dev';
const CONTACT_TO = 'erikhenriquealvescunha@gmail.com';
const CONTACT_SUBJECT_PREFIX = '[portfolio] message from';
const RESEND_TIMEOUT_MS = 10_000;
const MIN_SEND_TIMEOUT_MS = 1;
const RESEND_TIMEOUT_ERROR = 'contact delivery timeout';

let resend: Resend | undefined;

export async function sendContactMessage(
  msgId: string,
  message: ContactMessage,
  requestId: string,
  deadlineAt?: number,
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
      const timeoutMs =
        deadlineAt === undefined
          ? RESEND_TIMEOUT_MS
          : Math.min(RESEND_TIMEOUT_MS, Math.max(MIN_SEND_TIMEOUT_MS, deadlineAt - Date.now()));
      timerId = setTimeout(() => reject(new Error(RESEND_TIMEOUT_ERROR)), timeoutMs);
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

export async function sendContactRetryAlert(msgIds: string[], requestId: string): Promise<void> {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  try {
    if (!env.RESEND_API_KEY) {
      log.error('contact retry alert failed', { requestId });
      return;
    }
    resend ??= new Resend(env.RESEND_API_KEY);
    const sendPromise = resend.emails.send({
      from: ALERT_FROM,
      to: CONTACT_TO,
      subject: contactRetryAlertContent.subject,
      text: `${contactRetryAlertContent.message}\n\n${msgIds.join('\n')}\nRequest: ${requestId}`,
    });
    const timeout = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => reject(new Error(ALERT_TIMEOUT_ERROR)), ALERT_TIMEOUT_MS);
    });
    const { error } = await Promise.race([sendPromise, timeout]);
    if (error) log.error('contact retry alert failed', { requestId });
  } catch {
    log.error('contact retry alert failed', { requestId });
  } finally {
    if (timerId !== undefined) clearTimeout(timerId);
  }
}
