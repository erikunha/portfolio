import { z } from 'zod';
import { contactCopy } from './contact-copy';

export const ContactContentSchema = z.object({
  success: z.object({ title: z.string().min(1), message: z.string().min(1) }),
  queued: z.object({
    title: z.string().min(1),
    message: z.string().min(1),
    linkLabel: z.string().min(1),
    linkHref: z.url(),
  }),
  section: z.object({
    command: z.string().min(1),
    mobileCommand: z.string().min(1),
    reply: z.string().min(1),
    linkedinPrompt: z.string().min(1),
    linkedinLabel: z.string().min(1),
    emailLabel: z.string().min(1),
    email: z.email(),
    linkedinHref: z.url(),
    copyEmail: z.string().min(1),
  }),
  form: z.object({
    nameLabel: z.string().min(1),
    emailLabel: z.string().min(1),
    messageLabel: z.string().min(1),
    namePlaceholder: z.string().min(1),
    emailPlaceholder: z.string().min(1),
    messagePlaceholder: z.string().min(1),
    submit: z.string().min(1),
    submitting: z.string().min(1),
    waiting: z.string().min(1),
    errorPrefix: z.string().min(1),
    errorSummary: z.string().min(1),
    retained: z.string().min(1),
    retryEmail: z.string().min(1),
    counterSeparator: z.string().min(1),
    fieldLabels: z.object({
      name: z.string().min(1),
      email: z.string().min(1),
      message: z.string().min(1),
    }),
  }),
  errors: z.object({
    name: z.string().min(1),
    email: z.string().min(1),
    message: z.string().min(1),
    storageUnavailable: z.string().min(1),
    retryUnavailable: z.string().min(1),
    rateLimited: z.string().min(1),
    requestFailed: z.string().min(1),
  }),
});

export type ContactContent = z.infer<typeof ContactContentSchema>;

export const contactContent: ContactContent = ContactContentSchema.parse(contactCopy);
