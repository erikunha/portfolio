const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ValidationResult =
  | { ok: true; name: string; email: string; message: string }
  | { ok: false; error: string };

export function validateContact(body: {
  name?: unknown;
  email?: unknown;
  message?: unknown;
}): ValidationResult {
  const name    = typeof body.name    === 'string' ? body.name.trim()    : '';
  const email   = typeof body.email   === 'string' ? body.email.trim()   : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!name || !email || !message) return { ok: false, error: 'all fields required' };
  if (!EMAIL_RE.test(email))        return { ok: false, error: 'invalid email address' };
  if (name.length > 120)            return { ok: false, error: 'name too long' };
  if (message.length < 10)          return { ok: false, error: 'message too short' };
  if (message.length > 2000)        return { ok: false, error: 'message too long (max 2000 chars)' };
  return { ok: true, name, email, message };
}
