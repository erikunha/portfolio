import { z } from 'zod';
import { CompanyUrlSchema } from './schema-primitives';

const ReadingTextSchema = z.string().min(1);

export const ReadingViewsSchema = z.object({
  shared: z.object({
    hire: z.object({
      label: ReadingTextSchema,
      ariaLabel: ReadingTextSchema,
      href: z.url(),
    }),
    newTabHint: ReadingTextSchema,
    ogImage: z.object({ path: z.string().startsWith('/'), width: z.number(), height: z.number() }),
  }),
  cv: z.object({
    path: z.string().startsWith('/'),
    title: ReadingTextSchema,
    description: ReadingTextSchema,
    summaryLinkLabel: ReadingTextSchema,
    pdf: z.object({
      href: z.string().startsWith('/'),
      label: ReadingTextSchema,
    }),
    headings: z.object({
      summary: ReadingTextSchema,
      experience: ReadingTextSchema,
      skills: ReadingTextSchema,
      certifications: ReadingTextSchema,
      community: ReadingTextSchema,
      education: ReadingTextSchema,
      contact: ReadingTextSchema,
    }),
    credentialLabels: z.record(z.string(), ReadingTextSchema),
    credentialBadges: z.record(z.string(), ReadingTextSchema),
  }),
  summary: z.object({
    path: z.string().startsWith('/'),
    title: ReadingTextSchema,
    description: ReadingTextSchema,
    cvLinkLabel: ReadingTextSchema,
    statsLabel: ReadingTextSchema,
    experienceLabel: ReadingTextSchema,
    projectNames: z.array(ReadingTextSchema).min(1),
    stack: z.object({
      core: z.array(ReadingTextSchema).min(1),
      ai: z.array(ReadingTextSchema).min(1),
    }),
    stackLabels: z.object({ core: ReadingTextSchema, ai: ReadingTextSchema }),
    headings: z.object({
      projects: ReadingTextSchema,
      stack: ReadingTextSchema,
      contact: ReadingTextSchema,
    }),
  }),
});

export type ReadingViews = z.infer<typeof ReadingViewsSchema>;

const ReadingRowSchema = z.object({
  key: ReadingTextSchema,
  label: ReadingTextSchema,
  value: ReadingTextSchema,
});

const CvSkillGroupSchema = z.object({
  label: ReadingTextSchema,
  items: z.array(ReadingTextSchema).min(1),
});

export const CvDocumentSchema = z.object({
  name: ReadingTextSchema,
  role: ReadingTextSchema,
  location: ReadingTextSchema,
  links: z
    .array(z.object({ label: ReadingTextSchema, href: ReadingTextSchema, external: z.boolean() }))
    .min(1),
  summary: ReadingTextSchema,
  experience: z
    .array(
      z.object({
        key: ReadingTextSchema,
        company: ReadingTextSchema,
        companyUrl: CompanyUrlSchema.optional(),
        meta: ReadingTextSchema,
        context: ReadingTextSchema.optional(),
        bullets: z.array(ReadingTextSchema).min(1),
      }),
    )
    .min(1),
  skills: z.array(CvSkillGroupSchema).min(1),
  certifications: z.array(ReadingRowSchema),
  community: z.object({
    heading: ReadingTextSchema,
    href: z.url().optional(),
    bullets: z.array(ReadingTextSchema),
    status: ReadingTextSchema,
  }),
  education: z.array(ReadingRowSchema),
  languages: ReadingTextSchema,
  email: ReadingTextSchema,
});

export const SummaryDocumentSchema = z.object({
  name: ReadingTextSchema,
  tagline: ReadingTextSchema,
  technologyLine: ReadingTextSchema,
  context: ReadingTextSchema,
  employer: z.object({ name: ReadingTextSchema, url: CompanyUrlSchema }),
  stats: z.array(z.object({ value: ReadingTextSchema, label: ReadingTextSchema })).min(1),
  projects: z
    .array(
      z.object({
        name: ReadingTextSchema,
        label: ReadingTextSchema,
        value: ReadingTextSchema,
        description: ReadingTextSchema,
      }),
    )
    .min(1),
  languages: ReadingTextSchema,
  email: ReadingTextSchema,
});

export const CvJsonLdSchema = z.object({
  '@context': z.literal('https://schema.org'),
  '@type': z.literal('ProfilePage'),
  url: z.url(),
  name: ReadingTextSchema,
  mainEntity: z.object({
    '@type': z.literal('Person'),
    name: ReadingTextSchema,
    jobTitle: ReadingTextSchema,
    url: z.url(),
    sameAs: z.array(z.url()).min(1),
    worksFor: z.object({
      '@type': z.literal('Organization'),
      name: ReadingTextSchema,
      url: CompanyUrlSchema,
    }),
  }),
});
