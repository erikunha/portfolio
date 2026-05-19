import type { NextRequest } from 'next/server';
import { Resend } from 'resend';
import { validateContact } from '@/lib/contact-validation';
import { getClientIp, getContactLimit, getRedis } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

let _resend: Resend | undefined;
function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  _resend ??= new Resend(key);
  return _resend;
}

export async function POST(req: NextRequest) {
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

  const result = validateContact(body as Record<string, unknown>);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  const { name, email, message } = result;

  // Durability first: write to KV before attempting delivery.
  // Hash the IP before persisting — raw IP is personal data under LGPD/GDPR.
  const msgId = crypto.randomUUID();
  const ipBytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(ip + (process.env.DEPLOY_SALT ?? 'portfolio')),
  );
  const ipHash = Buffer.from(ipBytes).toString('hex').slice(0, 16);
  const payload = { name, email, message, receivedAt: new Date().toISOString(), ipHash };

  try {
    await getRedis().set(`contact:msg:${msgId}`, JSON.stringify(payload), {
      ex: 60 * 60 * 24 * 90,
    });
  } catch (kvErr) {
    console.error('[contact] KV write failed', kvErr);
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
      console.error('[contact] resend error (message saved to KV as', msgId, ')', error);
    }
  } catch (sendErr) {
    const reason = sendErr instanceof Error ? sendErr.message : String(sendErr);
    // Distinguishes timeout ("resend timeout (10s)") from genuine SDK failures
    // in Vercel runtime logs without losing the original error object.
    console.error(
      '[contact] resend unavailable (message saved to KV as',
      msgId,
      ') reason:',
      reason,
      sendErr,
    );
  } finally {
    // Always clear the timer so the serverless invocation can exit immediately
    // after a fast Resend success rather than staying alive for the full 10s.
    if (timerId !== undefined) clearTimeout(timerId);
  }

  return Response.json({ ok: true });
}
