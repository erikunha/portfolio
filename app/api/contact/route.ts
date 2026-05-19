import type { NextRequest } from 'next/server';
import { Resend } from 'resend';
import { isHoneypotTripped, validateContact } from '@/lib/contact-validation';
import { hashIp } from '@/lib/ip-hash';
import { log } from '@/lib/log';
import { getClientIp, getContactLimit, getRedis } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Honeypot timing jitter range. Real Resend round-trip is typically 150-400ms;
// a silent-success response with 50-150ms jitter sits inside that envelope so
// a bot timing the response against legitimate submissions can't tell apart
// "got 200 because honeypot tripped" vs "got 200 because email sent".
const HONEYPOT_JITTER_MIN_MS = 50;
const HONEYPOT_JITTER_MAX_MS = 150;

let _resend: Resend | undefined;
function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  _resend ??= new Resend(key);
  return _resend;
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const ip = getClientIp(req);

  const { success } = await getContactLimit().limit(ip);
  if (!success) {
    return Response.json({ error: 'too many requests — try again in 10 minutes' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid request body' }, { status: 400 });
  }

  // Honeypot trip: return a successful-looking 200 with timing jitter that
  // matches a real Resend round-trip. No persistence, no delivery, no error.
  // Logs the trip so we can audit volume; the ipHash isn't computed here
  // (lazy resolve cost is wasted on bot traffic — the IP would land in the
  // rate-limit accounting anyway via the limit() call above).
  if (isHoneypotTripped(body as Record<string, unknown>)) {
    log.info('contact honeypot tripped', { requestId });
    const jitterMs =
      HONEYPOT_JITTER_MIN_MS +
      Math.floor(Math.random() * (HONEYPOT_JITTER_MAX_MS - HONEYPOT_JITTER_MIN_MS));
    await new Promise((r) => setTimeout(r, jitterMs));
    return Response.json({ ok: true });
  }

  const result = validateContact(body as Record<string, unknown>);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  const { name, email, message } = result;

  // Durability first: write to KV before attempting delivery.
  // Hash the IP before persisting — raw IP is personal data under LGPD/GDPR.
  const msgId = crypto.randomUUID();
  const ipHash = await hashIp(ip);
  const payload = { name, email, message, receivedAt: new Date().toISOString(), ipHash };

  try {
    await getRedis().set(`contact:msg:${msgId}`, JSON.stringify(payload), {
      ex: 60 * 60 * 24 * 90,
    });
  } catch (kvErr) {
    log.error('KV write failed', { requestId, msgId, err: kvErr });
    return Response.json({ error: 'storage unavailable — try again' }, { status: 502 });
  }

  // Delivery second: failure is acceptable if KV write succeeded.
  // 10s timeout via Promise.race — Resend SDK v6 doesn't accept AbortSignal
  // natively. On timeout, the rejected Promise enters the existing catch path
  // and the message remains durably persisted in KV with msgId for recovery.
  // timerId is captured so the finally block can clear it after a fast success,
  // preventing the serverless invocation from staying alive until the timer fires.
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
      timerId = setTimeout(() => reject(new Error('resend timeout (10s)')), 10_000);
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
    // Always clear the timer so the serverless invocation can exit immediately
    // after a fast Resend success rather than staying alive for the full 10s.
    if (timerId !== undefined) clearTimeout(timerId);
  }

  return Response.json({ ok: true });
}
