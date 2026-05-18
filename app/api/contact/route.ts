import type { NextRequest } from 'next/server';
import { Resend } from 'resend';
import { validateContact } from '@/lib/contact-validation';
import { hashIp } from '@/lib/ip-hash';
import { log } from '@/lib/log';
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
  try {
    const { error } = await getResend().emails.send({
      from: 'onboarding@resend.dev',
      to: 'erikhenriquealvescunha@gmail.com',
      replyTo: email,
      subject: `[portfolio] message from ${name}`,
      text: `From: ${name} <${email}>\nRef: ${msgId}\n\n${message}`,
    });
    if (error) {
      log.error('Resend error', { requestId, msgId, err: error });
    }
  } catch (sendErr) {
    const reason = sendErr instanceof Error ? sendErr.message : String(sendErr);
    // Distinguishes timeout ("resend timeout (10s)") from genuine SDK failures.
    log.error('Resend unavailable', { requestId, msgId, reason, err: sendErr });
  }

  return Response.json({ ok: true });
}
