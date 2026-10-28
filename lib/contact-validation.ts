import { z } from 'zod';

export const CONTACT_LIMITS = {
  nameMin: 1,
  nameMax: 120,
  messageMin: 10,
  messageMax: 2_000,
} as const;

export const CONTACT_FIELD = {
  NAME: 'name',
  EMAIL: 'email',
  MESSAGE: 'message',
} as const;

export type ContactField = (typeof CONTACT_FIELD)[keyof typeof CONTACT_FIELD];

export const ContactSchema = z.object({
  name: z.string().trim().min(CONTACT_LIMITS.nameMin).max(CONTACT_LIMITS.nameMax),
  email: z.string().trim().email(),
  message: z.string().trim().min(CONTACT_LIMITS.messageMin).max(CONTACT_LIMITS.messageMax),
  field_company: z.string().optional(),
});

export function isHoneypotTripped(body: { field_company?: unknown }): boolean {
  return typeof body.field_company === 'string' && body.field_company.trim().length > 0;
}
