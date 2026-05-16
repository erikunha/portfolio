import { validateContact } from '@/lib/contact-validation';
import { getContactLimit, getRedis } from '@/lib/rate-limit';
import type { NextRequest } from 'next/server';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

let _resend: Resend | undefined;
function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  _resend ??= new Resend(key);
  return _resend;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'anon';

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
  const msgId   = crypto.randomUUID();
  const ipBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + (process.env.DEPLOY_SALT ?? 'portfolio')));
  const ipHash  = Buffer.from(ipBytes).toString('hex').slice(0, 16);
  const payload = { name, email, message, receivedAt: new Date().toISOString(), ipHash };

  try {
    await getRedis().set(`contact:msg:${msgId}`, JSON.stringify(payload), { ex: 60 * 60 * 24 * 90 });
  } catch (kvErr) {
    console.error('[contact] KV write failed', kvErr);
    return Response.json({ error: 'storage unavailable — try again' }, { status: 502 });
  }

  // Delivery second: failure is acceptable if KV write succeeded.
  const { error } = await getResend().emails.send({
    from: 'portfolio@erikunha.dev',
    to: 'erikhenriquealvescunha@gmail.com',
    replyTo: email,
    subject: `[portfolio] message from ${name}`,
    text: `From: ${name} <${email}>\nRef: ${msgId}\n\n${message}`,
  });
  if (error) {
    console.error('[contact] resend error (message saved to KV as', msgId, ')', error);
    return Response.json({ ok: true, warn: 'delivery delayed' });
  }

  return Response.json({ ok: true });
}
