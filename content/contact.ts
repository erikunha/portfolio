import { z } from 'zod';
import { contactCopy } from './contact-copy';
import { formatLanguages, profile } from './profile';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

const CopySchema = z.string().min(1);
const AXIS_LABEL_COUNT = 5;

const TimezonePanelSchema = z.object({
  title: CopySchema,
  marker: CopySchema,
  status: z.object({ online: CopySchema, offHours: CopySchema }),
  clocks: z.object({ erik: CopySchema, you: CopySchema, link: CopySchema }),
  map: z.object({
    erikPlace: CopySchema,
    erikLabel: CopySchema,
    youLabel: CopySchema,
    ariaLabel: CopySchema,
  }),
  location: z.object({
    youAre: CopySchema,
    detectedAuto: CopySchema,
    detectedManual: CopySchema,
  }),
  search: z.object({
    label: CopySchema,
    placeholder: CopySchema,
    listLabel: CopySchema,
    count: CopySchema,
  }),
  rows: z.object({ erik: CopySchema, you: CopySchema, both: CopySchema }),
  axis: z.array(CopySchema).length(AXIS_LABEL_COUNT),
  slot: z.object({ title: CopySchema, you: CopySchema, erik: CopySchema, none: CopySchema }),
  propose: z.object({
    label: CopySchema,
    line: CopySchema,
    added: CopySchema,
    focusLink: CopySchema,
  }),
  overlap: z.object({
    summary: CopySchema,
    range: CopySchema,
    none: CopySchema,
    separator: CopySchema,
  }),
  hours: z.object({ one: CopySchema, other: CopySchema }),
  facts: z.object({
    availabilityLabel: CopySchema,
    modeLabel: CopySchema,
    modeValue: CopySchema,
    relocationLabel: CopySchema,
    relocationValue: CopySchema,
    engagementLabel: CopySchema,
    engagementValue: CopySchema,
    replyLabel: CopySchema,
    replyValue: CopySchema,
  }),
  announce: CopySchema,
});

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
    email: z.email(),
    linkedinHref: z.url(),
    copyEmail: z.string().min(1),
    copyEmailCopied: z.string().min(1),
    loadingLabel: z.string().min(1),
  }),
  channels: z.object({
    title: z.string().min(1),
    marker: z.string().min(1),
    emailLabel: z.string().min(1),
    linkedinLabel: z.string().min(1),
    linkedinCta: z.string().min(1),
    linkedinGlyph: z.string().min(1),
    linkedinNewTabNote: z.string().min(1),
    githubLabel: z.string().min(1),
    githubAccessibleLabel: z.string().min(1),
    languagesLabel: z.string().min(1),
  }),
  timezone: TimezonePanelSchema,
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

export const contactContent: Record<SiteLocale, ContactContent> = {
  [SITE_LOCALE.en]: ContactContentSchema.parse(contactCopy[SITE_LOCALE.en]),
  [SITE_LOCALE.pt]: ContactContentSchema.parse(contactCopy[SITE_LOCALE.pt]),
};

export const contactLanguages = formatLanguages(profile.languages);
