import { z } from 'zod';
import { CONTACT_DELIVERY_CODE, contactCopy } from './contact-copy';

export { CONTACT_DELIVERY_CODE };

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

export const contactContent: ContactContent = ContactContentSchema.parse(contactCopy);
