// lib/contact-validation.ts
// Anti-spam helpers for /api/contact. After PR 5c of the audit roadmap, the
// route's field-shape validation lives in a Zod schema inside the route
// file (single validation layer; `validateContact` was removed). This
// module retains the honeypot check because it's distinct from shape
// validation — even a body that passes the Zod schema can trip the
// honeypot if the hidden `field_company` field carries a value.

/**
 * Detects whether the hidden honeypot field was filled. `ContactForm`
 * renders `field_company` off-screen with `aria-hidden + tabindex=-1`;
 * legitimate users never see or fill it, so any non-empty value is a bot
 * signature. The route handler responds with a successful-looking 200 to
 * deny the bot any failure signal.
 */
export function isHoneypotTripped(body: { field_company?: unknown }): boolean {
  return typeof body.field_company === 'string' && body.field_company.trim().length > 0;
}
