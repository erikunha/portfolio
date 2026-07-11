import { z } from 'zod';

export const SocialSchema = z.object({
  github: z.string().url(),
  linkedin: z.string().url(),
  email: z.string().email(),
  site: z.string().url(),
  handle: z.string().min(1),
  whatsapp: z.string().url(),
});

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

export const BlameEntrySchema = z.object({
  dates: z.string().min(1),
  company: z.string().min(1),
  role: z.string().min(1),
  reason: z.string().min(1),
});

export const PerfReceiptSchema = z.object({
  metric: z.string().min(1),
  delta: z.string().min(1),
  company: z.string().min(1),
  note: z.string().min(1),
  mobileMetric: z.string().min(1).optional(),
  desktopOnly: z.boolean().optional(),
});

export const NpmTileSchema = z.object({
  label: z.string().min(1),
  path: z.string().min(1),
});

export const HottestTakeSchema = z.object({
  num: z.string().min(1),
  category: z.string().min(1),
  thesis: z.string().min(1),
  body: z.string().min(1),
});

export const ResponsibilitySchema = z.object({
  perms: z.string().regex(/^[-d][rwx-]{9}$/),
  user: z.string().min(1),
  group: z.string().min(1),
  name: z.string().min(1),
  highlight: z.boolean().default(false),
});

const _signalNodeBase = { name: z.string().min(1), subtitle: z.string().min(1) };
const _dotsNode = (role: 'INPUT' | 'AMP' | 'OUT') =>
  z.object({
    ..._signalNodeBase,
    role: z.literal(role),
    strengthDots: z.number().int().min(0).max(8),
  });
const _fxNode = z.object({
  ..._signalNodeBase,
  role: z.literal('FX'),
  blocks: z.array(z.object({ name: z.string().min(1), active: z.boolean() })).min(1),
});
export const SignalChainNodeSchema = z.discriminatedUnion('role', [
  _dotsNode('INPUT'),
  _fxNode,
  _dotsNode('AMP'),
  _dotsNode('OUT'),
]);

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
  signalChain: z.tuple([_dotsNode('INPUT'), _fxNode, _dotsNode('AMP'), _dotsNode('OUT')]),
  influences: z.array(InfluenceSchema).length(5),
  nowObsessing: z.string().min(1),
  stats: z.array(StatCellSchema).length(4),
  liveCam: z.object({
    photo: z.string().min(1),
    caption: z.string().min(1),
    status: z.string().min(1),
    cameraLabel: z.string().min(1),
  }),
});

export const UnknownItemSchema = z.object({
  claim: z.string().min(1),
  context: z.string().min(1),
});
export const UnknownsSchema = z.object({
  learning: z.array(UnknownItemSchema).min(1),
  notSpecializing: z.array(UnknownItemSchema).min(1),
  footer: z.string().min(1),
});

export const VisaRowSchema = z.object({
  jurisdiction: z.string().min(1),
  jurisdictionShort: z.string().min(1),
  status: z.string().min(1),
  statusShort: z.string().min(1),
  evidence: z.string().min(1),
});

export const CredentialSchema = z.object({
  label: z.string().min(1),
  badge: z.string().min(1),
  evidence: z.string().min(1),
});

export const CommunityEventSchema = z.object({
  name: z.string().min(1),
  year: z.number().int(),
  role: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(1),
  statusLine: z.string().min(1),
});

export const ManPageSchema = z.object({
  name: z.string().min(1),
  tagline: z.string().min(1),
  version: z.string().min(1),
  date: z.string().min(1),
  description: z.string().min(1),
  options: z.array(z.object({ flag: z.string().min(1), desc: z.string().min(1) })),
  knownBugs: z.array(z.string().min(1)),
});

export const NowRowSchema = z.object({
  k: z.string().min(1),
  v: z.string().min(1),
});

export const SysStatSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  pct: z.string().regex(/^\d{1,3}%$/),
});

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

export const ShellResponseSchema = z.object({
  commands: z.array(z.string().min(1)).min(1),
  kind: z.enum(['output', 'error']).default('output'),
  text: z.string().min(1),
});
export const ShellCommandsSchema = z.array(ShellResponseSchema).min(1);

export const TerminalChromeSchema = z.object({
  promptLabel: z.string().min(1),
  rightTag: z.string().min(1),
  mobileLabel: z.string().min(1).optional(),
});
export type TerminalChrome = z.infer<typeof TerminalChromeSchema>;

export const ReadmeCopySchema = z.object({
  desktopH1: z.string().min(1),
  desktopIntro: z.string().min(1),
  desktopCoreStack: z.array(z.string().min(1)).min(1),
  desktopPrinciples: z.array(z.string().min(1)).min(1),
  desktopStatusH2: z.string().min(1),
});
export type ReadmeCopy = z.infer<typeof ReadmeCopySchema>;

export const DmesgLineSchema = z.object({
  off: z.number(),
  prefix: z.string().min(1),
  bold: z.string().min(1).optional(),
  suffix: z.string().min(1).optional(),
  ok: z.boolean(),
});
export type DmesgLine = z.infer<typeof DmesgLineSchema>;

const DawMixerPluginSchema = z.object({
  name: z.string().min(1),
  active: z.boolean(),
  strength: z.number().int().min(0).max(5),
});

const DawMixerKnobSchema = z.object({
  label: z.string().min(1),
  angleDeg: z.number().min(-150).max(150),
});

const DawMixerChannelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  desktopName: z.string().optional(),
  desc: z.string().min(1),
  focused: z.boolean().optional(),
  plugins: z.array(DawMixerPluginSchema).min(1).max(5),
  faderPct: z.number().min(0).max(100),
  meterPct: z.number().min(0).max(100),
  meterClipping: z.boolean().optional(),
  knob1: DawMixerKnobSchema,
  knob2: DawMixerKnobSchema,
  buttons: z.array(z.string().min(1)),
  activeButtons: z.array(z.string().min(1)),
  footer: z.object({ lufs: z.string(), pk: z.string() }).optional(),
  terminalLines: z.array(z.string().min(1)).optional(),
});

export const DawMixerSchema = z.object({
  sessionName: z.string().min(1),
  bpm: z.number().int(),
  timeSignature: z.string().min(1),
  status: z.string().min(1),
  transportTime: z.string().min(1),
  channels: z
    .array(DawMixerChannelSchema)
    .length(6)
    .refine((chs) => chs[chs.length - 1]?.id === 'MASTER', {
      message: 'Last channel must be MASTER',
    }),
});

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
export type DawMixer = z.infer<typeof DawMixerSchema>;
export type DawMixerChannel = z.infer<typeof DawMixerChannelSchema>;
export type DawMixerPlugin = z.infer<typeof DawMixerPluginSchema>;
