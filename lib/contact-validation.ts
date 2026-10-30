import 'server-only';

import { z } from 'zod';

import { CONTACT_LIMITS } from '@/content/contact-copy';

export { CONTACT_FIELD, CONTACT_LIMITS, type ContactField } from '@/content/contact-copy';

export const ContactSchema = z.object({
  name: z.string().trim().min(CONTACT_LIMITS.nameMin).max(CONTACT_LIMITS.nameMax),
  email: z.string().trim().email(),
  message: z.string().trim().min(CONTACT_LIMITS.messageMin).max(CONTACT_LIMITS.messageMax),
  field_company: z.string().optional(),
});

export function isHoneypotTripped(body: { field_company?: unknown }): boolean {
  return typeof body.field_company === 'string' && body.field_company.trim().length > 0;
}
