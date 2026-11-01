import { z } from 'zod';
import { contactCopy } from './contact-copy';
import { formatLanguages, profile } from './profile';

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
    emailLabel: z.string().min(1),
    email: z.email(),
    linkedinHref: z.url(),
    copyEmail: z.string().min(1),
    copyEmailCopied: z.string().min(1),
  }),
  channels: z.object({
    title: z.string().min(1),
    marker: z.string().min(1),
    emailLabel: z.string().min(1),
    linkedinLabel: z.string().min(1),
    linkedinCta: z.string().min(1),
    linkedinAccessibleLabel: z.string().min(1),
    githubLabel: z.string().min(1),
    githubAccessibleLabel: z.string().min(1),
    replyLabel: z.string().min(1),
    replyValue: z.string().min(1),
    languagesLabel: z.string().min(1),
    timezoneLabel: z.string().min(1),
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
    errorSummary: z.object({
      one: z.string().min(1),
      many: z.string().min(1),
      separator: z.string().min(1),
    }),
    retained: z.string().min(1),
    retryEmail: z.string().min(1),
    counterSeparator: z.string().min(1),
    privacy: z.string().min(1),
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

export const contactLanguages = formatLanguages(profile.languages);
