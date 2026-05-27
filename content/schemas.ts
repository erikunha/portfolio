// content/schemas.ts
// Runtime Zod schemas for all typed content modules.
// Build fails if any content file violates its schema.
import { z } from 'zod';

export const SocialSchema = z.object({
  github: z.string().url(),
  linkedin: z.string().url(),
  email: z.string().email(),
  site: z.string().url(),
  handle: z.string().min(1),
  whatsapp: z.string().url(),
});

// ProjectsSection
export const StatSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});
export const ProjectSchema = z.object({
  name: z.string().min(1),
  mobileName: z.string().min(1),
  description: z.string().min(1),
  mobileDescription: z.string().min(1),
  stats: z.array(StatSchema).min(1),
  mobileMeta: z.array(StatSchema).min(1),
  perm: z.string().min(1).optional(),
});

// GitLogSection — the "blame" view of career history
export const BlameEntrySchema = z.object({
  dates: z.string().min(1),
  company: z.string().min(1),
  role: z.string().min(1),
  reason: z.string().min(1),
});

// PerfReceiptsSection
export const PerfReceiptSchema = z.object({
  metric: z.string().min(1),
  delta: z.string().min(1),
  company: z.string().min(1),
  note: z.string().min(1),
  mobileMetric: z.string().min(1).optional(), // abbreviated label for narrow viewports
  desktopOnly: z.boolean().optional(), // hidden on mobile via CSS
});

// NpmStackSection — SVG path is inline, kept in data layer
export const NpmTileSchema = z.object({
  label: z.string().min(1),
  path: z.string().min(1),
});

// HottestTakesSection
export const HottestTakeSchema = z.object({
  num: z.string().min(1),
  category: z.string().min(1),
  thesis: z.string().min(1),
  body: z.string().min(1),
});

// ResponsibilitiesSection
export const ResponsibilitySchema = z.object({
  perms: z.string().regex(/^[-d][rwx-]{9}$/),
  user: z.string().min(1),
  group: z.string().min(1),
  name: z.string().min(1),
  highlight: z.boolean().default(false),
});

// GuitarSection v2 — signal chain + influences + stats + live cam
export const SignalChainNodeSchema = z.object({
  role: z.enum(['INPUT', 'FX', 'AMP', 'OUT']),
  name: z.string().min(1),
  subtitle: z.string().min(1),
  strengthDots: z.number().int().min(0).max(8).optional(),
  blocks: z.array(z.object({ name: z.string().min(1), active: z.boolean() })).optional(),
});

export const InfluenceSchema = z.object({
  rank: z.number().int().min(1).max(5),
  name: z.string().min(1),
  strength: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  active: z.boolean().optional(),
});

export const StatCellSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  sub: z.string().min(1),
});

export const GuitarRigSchema = z.object({
  signalChain: z.array(SignalChainNodeSchema).length(4),
  influences: z.array(InfluenceSchema).length(5),
  nowObsessing: z.string().min(1),
  stats: z.array(StatCellSchema).length(4),
  liveCam: z.object({
    photo: z.string().min(1),
    caption: z.string().min(1),
  }),
});

// UnknownsSection
export const UnknownItemSchema = z.object({
  claim: z.string().min(1),
  context: z.string().min(1),
});
export const UnknownsSchema = z.object({
  learning: z.array(UnknownItemSchema).min(1),
  notSpecializing: z.array(UnknownItemSchema).min(1),
  footer: z.string().min(1),
});

// VisaSection
export const VisaRowSchema = z.object({
  jurisdiction: z.string().min(1),
  jurisdictionShort: z.string().min(1),
  status: z.string().min(1),
  statusShort: z.string().min(1),
  evidence: z.string().min(1),
});

// CredentialsSection
export const CredentialSchema = z.object({
  label: z.string().min(1),
  badge: z.string().min(1),
  evidence: z.string().min(1),
});

// CommunitySection
export const CommunityEventSchema = z.object({
  name: z.string().min(1),
  year: z.number().int(),
  role: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(1),
  statusLine: z.string().min(1),
});

// ManPageSection — text content extracted for type-safety
export const ManPageSchema = z.object({
  name: z.string().min(1),
  tagline: z.string().min(1),
  version: z.string().min(1),
  date: z.string().min(1),
  description: z.string().min(1),
  options: z.array(z.object({ flag: z.string().min(1), desc: z.string().min(1) })),
  knownBugs: z.array(z.string().min(1)),
});

// NowSection
export const NowRowSchema = z.object({
  k: z.string().min(1),
  v: z.string().min(1),
});

// SysHealthSection
export const SysStatSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  pct: z.string().regex(/^\d{1,3}%$/),
});

// GitLogSection
export const GitCommitSchema = z.object({
  hash: z.string().min(1),
  deco: z.string().min(1),
  date: z.string().min(1),
  branch: z.string().min(1),
  type: z.enum(['career', 'life']),
  company: z.string().min(1),
  role: z.string().min(1),
  body: z.array(z.string().min(1)),
  isRoot: z.boolean().optional(),
});

// InteractiveShell — local command responses
export const ShellResponseSchema = z.object({
  commands: z.array(z.string().min(1)).min(1),
  kind: z.enum(['output', 'error']).default('output'),
  text: z.string().min(1),
});
export const ShellCommandsSchema = z.array(ShellResponseSchema).min(1);

// ReadmeSection — prose copy extracted from JSX
export const ReadmeCopySchema = z.object({
  desktopH1: z.string().min(1),
  desktopIntro: z.string().min(1),
  desktopCoreStack: z.array(z.string().min(1)).min(1),
  desktopPrinciples: z.array(z.string().min(1)).min(1),
  desktopStatusH2: z.string().min(1),
});
export type ReadmeCopy = z.infer<typeof ReadmeCopySchema>;

// Footer DMESG — structured so no JSX lives in content
export const DmesgLineSchema = z.object({
  off: z.number(),
  prefix: z.string().min(1),
  bold: z.string().min(1).optional(),
  suffix: z.string().min(1).optional(),
  ok: z.boolean(),
});
export type DmesgLine = z.infer<typeof DmesgLineSchema>;

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
