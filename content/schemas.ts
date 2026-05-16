// content/schemas.ts
// Runtime Zod schemas for all typed content modules.
// Build fails if any content file violates its schema.
import { z } from 'zod';

export const SocialSchema = z.object({
  github: z.string().url(),
  linkedin: z.string().url(),
  email: z.string().email(),
  site: z.string().url(),
  handle: z.string(),
});

// ProjectsSection
export const StatSchema = z.object({ label: z.string(), value: z.string() });
export const ProjectSchema = z.object({
  name: z.string(),
  mobileName: z.string(),
  description: z.string(),
  mobileDescription: z.string(),
  stats: z.array(StatSchema).min(1),
  mobileMeta: z.array(StatSchema).min(1),
  perm: z.string().optional(),
});

// GitLogSection — the "blame" view of career history
export const BlameEntrySchema = z.object({
  dates: z.string(),
  company: z.string(),
  role: z.string(),
  reason: z.string(),
});

// PerfReceiptsSection
export const PerfReceiptSchema = z.object({
  metric: z.string(),
  delta: z.string(),
  company: z.string(),
  note: z.string(),
  mobileMetric: z.string().optional(), // abbreviated label for narrow viewports
  desktopOnly: z.boolean().optional(), // hidden on mobile via CSS
});

// NpmStackSection — SVG path is inline, kept in data layer
export const NpmTileSchema = z.object({
  label: z.string(),
  path: z.string(),
});

// HottestTakesSection
export const HottestTakeSchema = z.object({
  num: z.string(),
  category: z.string(),
  thesis: z.string(),
  body: z.string(),
});

// ResponsibilitiesSection
export const ResponsibilitySchema = z.object({
  perms: z.string().regex(/^[-d][rwx-]{9}$/),
  user: z.string(),
  group: z.string(),
  name: z.string(),
  highlight: z.boolean().default(false),
});

// GuitarSection — structured fields + influences
export const GuitarFieldSchema = z.object({ label: z.string(), value: z.string() });
export const GuitarInfluenceSchema = z.object({
  rank: z.number().int().min(1),
  name: z.string(),
});
export const GuitarRigSchema = z.object({
  fields: z.array(GuitarFieldSchema).min(1),
  influences: z.array(GuitarInfluenceSchema).min(1),
  comment: z.string(),
});

// UnknownsSection
export const UnknownItemSchema = z.object({
  claim: z.string(),
  context: z.string(),
});
export const UnknownsSchema = z.object({
  learning: z.array(UnknownItemSchema).min(1),
  notSpecializing: z.array(UnknownItemSchema).min(1),
  footer: z.string(),
});

// VisaSection
export const VisaRowSchema = z.object({
  jurisdiction: z.string(),
  jurisdictionShort: z.string(),
  status: z.string(),
  statusShort: z.string(),
  evidence: z.string(),
});

// CredentialsSection
export const CredentialSchema = z.object({
  label: z.string(),
  badge: z.string(),
  evidence: z.string(),
});

// CommunitySection
export const CommunityEventSchema = z.object({
  name: z.string(),
  year: z.number().int(),
  role: z.string(),
  bullets: z.array(z.string()).min(1),
  statusLine: z.string(),
});

// ManPageSection — text content extracted for type-safety
export const ManPageSchema = z.object({
  name: z.string(),
  tagline: z.string(),
  version: z.string(),
  date: z.string(),
  descriptionMobile: z.string(),
});

// NowSection
export const NowRowSchema = z.object({ k: z.string(), v: z.string() });

// SysHealthSection
export const SysStatSchema = z.object({
  label: z.string(),
  value: z.string(),
  pct: z.string().regex(/^\d{1,3}%$/),
});

// GitLogSection
export const GitCommitSchema = z.object({
  hash: z.string(),
  deco: z.string(),
  date: z.string(),
  branch: z.string(),
  type: z.enum(['career', 'life']),
  company: z.string(),
  role: z.string(),
  body: z.array(z.string()),
  isRoot: z.boolean().optional(),
});

// InteractiveShell — local command responses
export const ShellResponseSchema = z.object({
  commands: z.array(z.string()).min(1),
  kind: z.enum(['output', 'error']).default('output'),
  text: z.string().min(1),
});
export const ShellCommandsSchema = z.array(ShellResponseSchema).min(1);

// Exported types
export type Social = z.infer<typeof SocialSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type BlameEntry = z.infer<typeof BlameEntrySchema>;
export type PerfReceipt = z.infer<typeof PerfReceiptSchema>;
export type NpmTile = z.infer<typeof NpmTileSchema>;
export type HottestTake = z.infer<typeof HottestTakeSchema>;
export type Responsibility = z.infer<typeof ResponsibilitySchema>;
export type GuitarRig = z.infer<typeof GuitarRigSchema>;
export type UnknownItem = z.infer<typeof UnknownItemSchema>;
export type Unknowns = z.infer<typeof UnknownsSchema>;
export type VisaRow = z.infer<typeof VisaRowSchema>;
export type Credential = z.infer<typeof CredentialSchema>;
export type CommunityEvent = z.infer<typeof CommunityEventSchema>;
export type ManPage = z.infer<typeof ManPageSchema>;
export type NowRow = z.infer<typeof NowRowSchema>;
export type SysStat = z.infer<typeof SysStatSchema>;
export type GitCommit = z.infer<typeof GitCommitSchema>;
export type ShellResponse = z.infer<typeof ShellResponseSchema>;
