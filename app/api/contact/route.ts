// app/api/contact/route.ts
// Contact form endpoint. POST receives { name, email, message, field_company? }
// and writes durably to Upstash KV before attempting Resend delivery.
//
// PR 5c of audit roadmap: refactored to use lib/server/route.ts defineHandler
// for the unified envelope + X-Request-Id. validateContact's checks folded
// into the Zod schema below (single validation layer; the old function is
// gone in this commit).

import { Resend } from 'resend';
import { z } from 'zod';

import { isHoneypotTripped } from '@/lib/contact-validation';
import { hashIp } from '@/lib/ip-hash';
import { log } from '@/lib/log';
import { getContactLimit, getRedis } from '@/lib/rate-limit';
import { defineHandler, err, ok } from '@/lib/server/route';

export const dynamic = 'force-dynamic';

// Honeypot timing jitter range. Real Resend round-trip is typically 150-400ms;
// a silent-success response with 50-150ms jitter sits inside that envelope so
// a bot timing the response against legitimate submissions can't tell apart
// "got 200 because honeypot tripped" vs "got 200 because email sent".
const HONEYPOT_JITTER_MIN_MS = 50;
const HONEYPOT_JITTER_MAX_MS = 150;

const CONTACT_KV_TTL_S = 60 * 60 * 24 * 90; // 90 days
const RESEND_TIMEOUT_MS = 10_000;

// All validation lives in this schema (PR 5c folded validateContact's checks
// in). z.string().trim() applies before length/format checks so " a " counts
// as 1 char. field_company is the honeypot — optional, never required from
// real users.
const ContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  message: z.string().trim().min(10).max(2000),
  field_company: z.string().optional(),
});

let _resend: Resend | undefined;
function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  _resend ??= new Resend(key);
  return _resend;
}

export const POST = defineHandler({
  schema: ContactSchema,
  rateLimit: getContactLimit,
  rateLimitErrorMessage: 'too many requests — try again in 10 minutes',
  async handler({ body, ip, requestId }) {
    // Honeypot trip: return a successful-looking 200 with timing jitter that
    // matches a real Resend round-trip. No persistence, no delivery, no
    // error. Realistic bots fill every input including the hidden
    // field_company, so their bodies pass Zod validation. The honeypot
    // check on the validated body is therefore the meaningful guard.
    if (isHoneypotTripped(body)) {
      log.info('contact honeypot tripped', { requestId });
      const jitterMs =
        HONEYPOT_JITTER_MIN_MS +
        Math.floor(Math.random() * (HONEYPOT_JITTER_MAX_MS - HONEYPOT_JITTER_MIN_MS));
      await new Promise((r) => setTimeout(r, jitterMs));
      return ok({ requestId });
    }

    const { name, email, message } = body;

    // Durability first: write to KV before attempting delivery.
    // Hash the IP before persisting — raw IP is personal data under
    // LGPD/GDPR. ipHash is computed here (handler) rather than in
    // defineHandler's pre-flight because most requests don't need it.
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

    // Delivery second: failure is acceptable if KV write succeeded.
    // 10s timeout via Promise.race — Resend SDK v6 doesn't accept
    // AbortSignal natively. On timeout, the rejected Promise enters the
    // existing catch path and the message remains durably persisted in KV
    // with msgId for recovery. timerId is captured so the finally block
    // can clear it after a fast success, preventing the serverless
    // invocation from staying alive until the timer fires.
    let timerId: ReturnType<typeof setTimeout> | undefined;
    try {
      const sendPromise = getResend().emails.send({
        from: 'onboarding@resend.dev',
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
      // Distinguishes timeout ("resend timeout (10s)") from genuine SDK failures.
      log.error('Resend unavailable', { requestId, msgId, reason, err: sendErr });
    } finally {
      // Always clear the timer so the serverless invocation can exit
      // immediately after a fast Resend success rather than staying alive
      // for the full 10s.
      if (timerId !== undefined) clearTimeout(timerId);
    }

    return ok({ requestId });
  },
});
