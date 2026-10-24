import { z } from 'zod';
import { linksContent } from './links';

const LINKEDIN_PILL_ID = 'linkedin';

export const CONTACT_DELIVERY_CODE = { QUEUED: 'queued' } as const;

export const ContactContentSchema = z.object({
  success: z.object({ title: z.string().min(1), message: z.string().min(1) }),
  queued: z.object({
    title: z.string().min(1),
    message: z.string().min(1),
    linkLabel: z.string().min(1),
    linkHref: z.url(),
  }),
  form: z.object({
    nameLabel: z.string().min(1),
    emailLabel: z.string().min(1),
    messageLabel: z.string().min(1),
    requiredPlaceholder: z.string().min(1),
    messagePlaceholder: z.string().min(1),
    submit: z.string().min(1),
    submitting: z.string().min(1),
    waiting: z.string().min(1),
    errorPrefix: z.string().min(1),
  }),
  errors: z.object({
    storageUnavailable: z.string().min(1),
    retryUnavailable: z.string().min(1),
    rateLimited: z.string().min(1),
    requestFailed: z.string().min(1),
  }),
});

export type ContactContent = z.infer<typeof ContactContentSchema>;

export const contactContent: ContactContent = ContactContentSchema.parse({
  success: {
    title: 'EXECUTE_SEND :: SUCCESS',
    message: 'handshake initiated · expect reply within 48h',
  },
  queued: {
    title: 'EXECUTE_SEND :: QUEUED',
    message: 'saved, not delivered yet; delivery is retried automatically; for a faster reply use',
    linkLabel: 'LinkedIn',
    linkHref: linksContent.pills.find((pill) => pill.id === LINKEDIN_PILL_ID)?.href,
  },
  form: {
    nameLabel: '$ name:',
    emailLabel: '$ email:',
    messageLabel: '$ message:',
    requiredPlaceholder: '[INPUT REQUIRED]',
    messagePlaceholder: '[READY FOR DATA INPUT...]',
    submit: 'EXECUTE_SEND',
    submitting: 'TRANSMITTING...',
    waiting: 'waiting for manual override... _',
    errorPrefix: 'error:',
  },
  errors: {
    storageUnavailable: 'storage unavailable, try again',
    retryUnavailable: 'delivery retry unavailable, try again or use LinkedIn',
    rateLimited: 'too many requests, try again in 10 minutes',
    requestFailed: 'message could not be sent, try again',
  },
});
