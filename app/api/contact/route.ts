import { Resend } from 'resend';
import { z } from 'zod';

import { isHoneypotTripped } from '@/lib/contact-validation';
import { env } from '@/lib/env';
import { hashIp } from '@/lib/ip-hash';
import { log } from '@/lib/log';
import { getContactLimit, getRedis } from '@/lib/rate-limit';
import { defineHandler, err, ok } from '@/lib/server/route';

const HONEYPOT_JITTER_MIN_MS = 50;
const HONEYPOT_JITTER_MAX_MS = 150;

const CONTACT_KV_TTL_S = 60 * 60 * 24 * 90;
const RESEND_TIMEOUT_MS = 10_000;

const ContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  message: z.string().trim().min(10).max(2000),
  field_company: z.string().optional(),
});

let _resend: Resend | undefined;
function getResend(): Resend {
  const key = env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  _resend ??= new Resend(key);
  return _resend;
}

export const POST = defineHandler({
  schema: ContactSchema,
  rateLimit: getContactLimit,
  rateLimitErrorMessage: 'too many requests — try again in 10 minutes',
  async handler({ body, ip, requestId }) {
    if (isHoneypotTripped(body)) {
      log.info('contact honeypot tripped', { requestId });
      const jitterMs =
        HONEYPOT_JITTER_MIN_MS +
        Math.floor(Math.random() * (HONEYPOT_JITTER_MAX_MS - HONEYPOT_JITTER_MIN_MS));
      await new Promise((r) => setTimeout(r, jitterMs));
      return ok({ requestId });
    }

    const { name, email, message } = body;

    const msgId = crypto.randomUUID();
    const ipHash = await hashIp(ip);
    const payload = { name, email, message, receivedAt: new Date().toISOString(), ipHash };

    try {
      await getRedis().set(`contact:msg:${msgId}`, JSON.stringify(payload), {
        ex: CONTACT_KV_TTL_S,
      });
    } catch (kvErr) {
      log.error('KV write failed', { requestId, msgId, err: kvErr });
      return err({
        requestId,
        status: 502,
        code: 'storage_unavailable',
        message: 'storage unavailable — try again',
      });
    }

    let timerId: ReturnType<typeof setTimeout> | undefined;
    try {
      const sendPromise = getResend().emails.send({
        from: 'contact@erikunha.dev',
        to: 'erikhenriquealvescunha@gmail.com',
        replyTo: email,
        subject: `[portfolio] message from ${name}`,
        text: `From: ${name} <${email}>\nRef: ${msgId}\n\n${message}`,
      });
      const timeoutPromise = new Promise<never>((_, reject) => {
        timerId = setTimeout(() => reject(new Error('resend timeout (10s)')), RESEND_TIMEOUT_MS);
      });
      const { error } = await Promise.race([sendPromise, timeoutPromise]);
      if (error) {
        log.error('Resend error', { requestId, msgId, err: error });
      }
    } catch (sendErr) {
      const reason = sendErr instanceof Error ? sendErr.message : String(sendErr);
      log.error('Resend unavailable', { requestId, msgId, reason, err: sendErr });
    } finally {
      if (timerId !== undefined) clearTimeout(timerId);
    }

    return ok({ requestId });
  },
});
