const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ValidationResult =
  | { ok: true; name: string; email: string; message: string }
  | { ok: false; error: string };

export function validateContact(body: {
  name?: unknown;
  email?: unknown;
  message?: unknown;
}): ValidationResult {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!name || !email || !message) return { ok: false, error: 'all fields required' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'invalid email address' };
  if (name.length > 120) return { ok: false, error: 'name too long' };
  if (message.length < 10) return { ok: false, error: 'message too short' };
  if (message.length > 2000) return { ok: false, error: 'message too long (max 2000 chars)' };
  return { ok: true, name, email, message };
}

// Honeypot trip detection. ContactForm renders a hidden `field_company` input
// off-screen with aria-hidden+tabindex=-1; legitimate users never see or fill
// it, so any non-empty value is a bot signature. The route handler responds
// with a successful-looking 200 to deny the bot any failure signal.
export function isHoneypotTripped(body: { field_company?: unknown }): boolean {
  return typeof body.field_company === 'string' && body.field_company.trim().length > 0;
}
