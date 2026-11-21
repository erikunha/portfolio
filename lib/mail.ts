import 'server-only';

import { Resend } from 'resend';
import { env } from '@/lib/env';

export interface MailMessage {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  idempotencyKey?: string;
  timeoutMs: number;
}

export interface MailResult {
  error: unknown;
}

let client: Resend | undefined;

export async function sendMail(mail: MailMessage): Promise<MailResult> {
  client ??= new Resend(env.RESEND_API_KEY);
  const { error } = await client.emails.send(
    {
      from: mail.from,
      to: mail.to,
      ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
      subject: mail.subject,
      text: mail.text,
    },
    {
      ...(mail.idempotencyKey ? { idempotencyKey: mail.idempotencyKey } : {}),
      signal: AbortSignal.timeout(mail.timeoutMs),
    },
  );
  return { error };
}
