import { z } from 'zod';
import { EqSpectrumSchema } from './eq.schema';
import { FACT_SEPARATOR } from './fact-separator';
import { CompanyUrlSchema, LocalizedTextSchema, SectionTextSchema } from './schema-primitives';
import { SECTION_ICONS, SECTION_REGISTRY } from './section-registry';

export type { ReadingViews } from './cv.schema';
export {
  CvDocumentSchema,
  CvJsonLdSchema,
  ReadingViewsSchema,
  SummaryDocumentSchema,
} from './cv.schema';
export type { DawMixer, DawMixerChannel, DawMixerCopy, DawMixerPlugin } from './daw-mixer.schema';
export { DawMixerCopySchema, DawMixerSchema } from './daw-mixer.schema';
export type { EqBand, EqSpectrum } from './eq.schema';
export {
  EQ_DEFAULT_PEAK_Q,
  EQ_MAX_BAR_COUNT,
  EQ_MIN_BAR_COUNT,
  EQ_TEMPLATE_TOKENS,
  EqBandSchema,
  EqSpectrumSchema,
} from './eq.schema';
export type { ErrorsClientContent, ErrorsContent } from './errors.schema';
export { ErrorsClientContentSchema, ErrorsContentSchema } from './errors.schema';
export type { CopyFeedback, CopyFeedbackState, FooterContent } from './footer.schema';
export { CopyFeedbackSchema, FooterContentSchema } from './footer.schema';
export type {
  LinksChannel,
  LinksContent,
  LinksCopy,
  LinksPill,
  LinksPlaylist,
  LinksProfile,
} from './links.schema';
export {
  LinksChannelSchema,
  LinksContentSchema,
  LinksCopySchema,
  LinksPillSchema,
  LinksPlaylistSchema,
  LinksProfileSchema,
  LinksUpcomingSchema,
} from './links.schema';
export { createNavigationSchema } from './navigation.schema';
export type { LocalizedText } from './schema-primitives';
export { CompanyUrlSchema, LocalizedTextSchema } from './schema-primitives';
export type { ShellResponse, ShellUi, TerminalChrome } from './shell-ui.schema';
export {
  ShellCommandsSchema,
  ShellResponseSchema,
  ShellUiSchema,
  TerminalChromeSchema,
} from './shell-ui.schema';
export type { WorldMap } from './world-map.schema';
export { WorldMapSchema } from './world-map.schema';
export { SECTION_ICONS };

const FIRST_SECTION_ORDER = 1;
export const SectionSchema = z.object({
  id: SectionTextSchema,
  label: LocalizedTextSchema,
  srLabel: LocalizedTextSchema,
  order: z.number().int().min(FIRST_SECTION_ORDER).max(SECTION_REGISTRY.length),
  icon: z.enum(SECTION_ICONS),
});

export type Section = z.infer<typeof SectionSchema>;

export const SectionRegistrySchema = z
  .array(SectionSchema)
  .length(SECTION_REGISTRY.length)
  .refine((entries) => new Set(entries.map(({ id }) => id)).size === entries.length, {
    message: 'Section ids must be unique',
  })
  .refine((entries) => new Set(entries.map(({ order }) => order)).size === entries.length, {
    message: 'Section orders must be unique',
  })
  .refine((entries) => entries.every(({ order }, index) => order === FIRST_SECTION_ORDER + index), {
    message: 'Section orders must match array position and be contiguous from the first order',
  })
  .readonly();

export const SocialSchema = z.object({
  github: z.url(),
  githubLabel: z.string().min(1),
  linkedin: z.url(),
  linkedinLabel: z.string().min(1),
  email: z.email(),
  site: z.url(),
  siteLabel: z.string().min(1),
  handle: z.string().min(1),
  whatsapp: z.url(),
});

export const StatSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

export const HeroContentSchema = z.object({
  locationLabel: z.string().min(1),
  employerLabel: z.string().min(1),
  languageLabel: z.string().min(1),
  statsLabel: z.string().min(1),
  hire: z.object({ label: z.string().min(1), href: z.url(), accessibleLabel: z.string().min(1) }),
  actions: z
    .array(
      z.object({
        label: z.string().min(1),
        href: z.union([z.url(), z.string().regex(/^\/(?!\/)\S*$/)]),
        accessibleLabel: z.string().min(1),
        external: z.boolean(),
        hiddenOnWide: z.boolean().optional(),
      }),
    )
    .min(1),
  stats: z.array(StatSchema).length(4),
});

export const AboutContentSchema = z.object({
  title: z.string().min(1),
  command: z.string().min(1),
  marker: z.string().min(1),
  whoami: z.object({
    title: z.string().min(1),
    intro: z.string().min(1),
    principlesTitle: z.string().min(1),
    principles: z.array(z.string().min(1)).min(1),
    statusTitle: z.string().min(1),
    statusPrefix: z.string().min(1),
    role: z.string().min(1),
    statusSuffix: z.string().min(1),
    details: z.array(z.string().min(1)).min(1),
    gutterLines: z.number().int().positive(),
  }),
  now: z.object({
    title: z.string().min(1),
    rows: z
      .array(
        z.object({
          k: z.string().min(1),
          v: z.string().min(1),
          company: z.object({ name: z.string().min(1), url: CompanyUrlSchema }).optional(),
        }),
      )
      .min(1),
  }),
  responsibilities: z.object({ title: z.string().min(1), command: z.string().min(1) }),
  stack: z.object({
    title: z.string().min(1),
    groups: z
      .array(z.object({ label: z.string().min(1), items: z.array(z.string().min(1)).min(1) }))
      .min(1),
  }),
  code: z.object({
    title: z.string().min(1),
    repoLabel: z.string().min(1),
    repoGlyph: z.string().min(1),
    repoHref: z.url(),
    repoNewTabNote: z.string().min(1),
    tokens: z
      .array(
        z.object({ id: z.number().int().nonnegative(), text: z.string(), className: z.string() }),
      )
      .min(1),
  }),
});
export type AboutContent = z.infer<typeof AboutContentSchema>;

export const ProjectKind = z.enum(['professional', 'oss']);

export const ProjectSchema = z
  .object({
    company: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    stats: z.array(StatSchema).min(1),
    perm: z.string().min(1).optional(),
    kind: ProjectKind,
    url: z.url().optional(),
  })
  .refine((project) => project.kind !== ProjectKind.enum.oss || project.url !== undefined);

export const PerfReceiptSchema = z.object({
  metric: z.string().min(1),
  delta: z
    .string()
    .regex(
      /^[+-]\d+(\.\d+)?%$/,
      'a perf receipt delta must be a bare signed percentage and nothing else: "-52%", "+10%", "-97.5%". __tests__/metric-consistency.test.ts flips the sign and searches every public surface for the resulting string, so the delta has to be a token a surface can literally contain. A trailing gloss ("-40% build time") or a missing sign ("10%") flips to a string no surface holds: the sweep for that metric then silently passes forever instead of failing. Put the gloss in `note`. The sibling idiom lives one import away in lib/hiring-profile.ts ("-97.5% (40s → <1s, Venturus)"); that field is a plain string and is compared by prefix, this one is not.',
    ),
  company: z.string().min(1),
  note: z.string().min(1),
  project: z.boolean().default(false),
  displayValue: z.string().min(1).optional(),
  before: z.number().nonnegative().optional(),
  after: z.number().nonnegative().optional(),
});

export const MeasuredSchema = z.object({
  format: z.object({
    locale: z.string().min(1),
    percentScale: z.number().positive(),
    costPrecision: z.number().int().nonnegative(),
    dateLength: z.number().int().positive(),
    millisecondsPerSecond: z.number().positive(),
    askStaleAfterMs: z.number().positive(),
    empty: z.string().min(1),
  }),
  title: z.string().min(1),
  command: z.string().min(1),
  sourceLabel: z.string().min(1),
  externalDisclosure: z.string().min(1),
  unavailable: z.string().min(1),
  loading: z.string().min(1),
  stale: z.string().min(1),
  unknownTimestamp: z.string().min(1),
  ask: z.object({
    title: z.string().min(1),
    source: z.string().min(1),
    url: z.url(),
    cacheKey: z.string().min(1),
    timestampLabel: z.string().min(1),
    pending: z.string().min(1),
    unavailable: z.string().min(1),
    p95Prefix: z.string().min(1),
    p95Pending: z.string().min(1),
    percentUnit: z.string().min(1),
    latencyUnit: z.string().min(1),
    currencyUnit: z.string().min(1),
    metrics: z
      .array(
        z.object({
          key: z.enum(['evalPassRate', 'jailbreakResistance', 'p95LatencyMs', 'costPerAnswer']),
          label: z.string().min(1),
          description: z.string(),
        }),
      )
      .length(4),
  }),
  psi: z.object({
    title: z.string().min(1),
    source: z.string().min(1),
    url: z.url(),
    timestampLabel: z.string().min(1),
    pairSeparator: z.string().min(1),
    strategies: z
      .array(
        z.object({
          key: z.enum(['desktop', 'mobile']),
          label: z.string().min(1),
        }),
      )
      .length(2),
    metrics: z
      .array(
        z.object({
          key: z.enum(['performance', 'accessibility', 'bestPractices', 'seo']),
          label: z.string().min(1),
        }),
      )
      .length(4),
  }),
});

export type Measured = z.infer<typeof MeasuredSchema>;

export const TAKE_PLACEMENT = { home: 'home', docs: 'docs' } as const;

export const HottestTakeSchema = z.object({
  placement: z.enum(TAKE_PLACEMENT),
  order: z.number().int().positive(),
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

export const GUITAR_SIGNAL_BAR_COUNT = 8;
export const GUITAR_SIGNAL_LABEL_TOKENS = { strength: '{n}', total: '{total}' } as const;

const _signalNodeBase = { name: z.string().min(1), subtitle: z.string().min(1) };
const _dotsNode = (role: 'INPUT' | 'AMP' | 'OUT') =>
  z.object({
    ..._signalNodeBase,
    role: z.literal(role),
    strengthDots: z.number().int().min(0).max(GUITAR_SIGNAL_BAR_COUNT),
  });
export const SignalChainNodeSchema = z.discriminatedUnion('role', [
  _dotsNode('INPUT'),
  _dotsNode('AMP'),
  _dotsNode('OUT'),
]);

export const InfluenceSchema = z.object({
  name: z.string().min(1),
});

export const StatCellSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  sub: z.string().min(1),
});

export const GuitarRigSchema = z.object({
  eqSpectrum: EqSpectrumSchema,
  signalChain: z.tuple([_dotsNode('INPUT'), _dotsNode('AMP'), _dotsNode('OUT')]),
  influences: z.array(InfluenceSchema).length(5),
  stats: z.array(StatCellSchema).length(4),
  liveCam: z.object({
    photo: z.string().min(1),
    caption: z.string().min(1),
    status: z.string().min(1),
    cameraLabel: z.string().min(1),
  }),
});

const [guitarInputSchema, guitarAmpSchema, guitarOutputSchema] =
  GuitarRigSchema.shape.signalChain.def.items;
const GuitarPresentationCopySchema = z.object({
  label: z.string().trim().nonempty(),
  text: z.string().trim().nonempty(),
});

export const GuitarPresentationSchema = z.object({
  signalStrengthLabelTemplate: z
    .string()
    .includes(GUITAR_SIGNAL_LABEL_TOKENS.strength)
    .includes(GUITAR_SIGNAL_LABEL_TOKENS.total),
  signalStrip: z.object({
    live: z.string().trim().nonempty(),
    tail: z.string().trim().nonempty(),
  }),
  eqSpectrum: EqSpectrumSchema,
  signalChain: z.tuple([
    guitarInputSchema.extend({ label: z.string().trim().nonempty() }),
    guitarAmpSchema.extend({ label: z.string().trim().nonempty() }),
    guitarOutputSchema.extend({ label: z.string().trim().nonempty() }),
  ]),
  influences: GuitarPresentationCopySchema,
  nowPlaying: GuitarPresentationCopySchema,
  stats: GuitarRigSchema.shape.stats,
  photo: z.object({
    src: z.string().trim().nonempty(),
    alt: z.string().trim().nonempty(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
});
export type GuitarPresentation = z.infer<typeof GuitarPresentationSchema>;

export const UnknownItemSchema = z.object({
  claim: z.string().min(1),
  context: z.string().min(1),
  showContext: z.boolean().default(true),
});
export const UnknownsSchema = z.object({
  learningHeading: z.string().min(1),
  notSpecializingHeading: z.string().min(1),
  learning: z.array(UnknownItemSchema).min(1),
  notSpecializing: z.array(UnknownItemSchema).min(1),
  footer: z.string().min(1),
});

export const CredentialSchema = z.object({
  label: z.string().min(1),
  badge: z.string().min(1),
  evidence: z.string().min(1),
});

export const CareerCopySchema = z.object({
  heading: z.string().min(1),
  headerCommand: z.string().min(1),
  mobileHeaderCommand: z.string().min(1),
  prompt: z.string().min(1),
  command: z.string().min(1),
  cvLabel: z.string().min(1),
  cvHref: z.string().startsWith('/'),
  graph: z.string().min(1),
  pipe: z.string().min(1),
});

const CareerTagGroupSchema = z.object({
  label: z.string().min(1),
  command: z.string().min(1),
  prefix: z.string().min(1),
});

export const CareerCredentialsSchema = z.object({
  prompt: z.string().min(1),
  statusMarker: z.string().min(1),
  certifications: CareerTagGroupSchema,
  education: CareerTagGroupSchema,
  community: z.object({
    label: z.string().min(1),
    command: z.string().min(1),
    heading: z.string().min(1),
    bullets: z.array(z.string().min(1)).min(1),
    status: z.string().min(1),
  }),
});

export const CommunityEventSchema = z.object({
  name: z.string().min(1),
  year: z.number().int(),
  role: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(1),
  link: z.object({ label: z.string().min(1), href: z.url() }),
  newTabLabel: z.string().min(1),
  statusLine: z.string().min(1),
});

export const ContextFactsSchema = z
  .array(
    z
      .string()
      .min(1)
      .refine((fact) => !fact.includes(FACT_SEPARATOR), {
        message: `a context fact must not contain "${FACT_SEPARATOR}": the separator is drawn between facts, so one inside a fact would split it in two`,
      }),
  )
  .min(1);

const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const ProfileSchema = z.object({
  fullName: z.string().min(1),
  displayName: z.string().min(1),
  title: z.string().min(1),
  stackLine: z.string().min(1),
  aiLine: z.string().min(1),
  country: z.string().min(1),
  city: z.string().min(1),
  timezone: z.string().min(1),
  availability: z.string().min(1),
  currentEmployer: z.object({
    name: z.string().min(1),
    url: CompanyUrlSchema,
    contextFacts: ContextFactsSchema,
  }),
  languages: z
    .array(
      z.object({
        code: z.string().min(1),
        label: z.string().min(1),
        name: z.string().min(1),
        level: z.string().min(1),
      }),
    )
    .min(1),
  actions: z
    .array(
      z.object({
        label: z.string().min(1),
        href: z.union([z.url().startsWith('https://'), z.string().regex(/^\/(?!\/)\S*$/)]),
      }),
    )
    .min(1),
});

export const EducationSchema = z
  .object({
    id: z.string().min(1),
    degree: z.string().min(1),
    institution: z.string().min(1),
    location: z.string().min(1),
    studyMode: z.string().min(1).nullable(),
    startYear: z.number().int().nullable(),
    endYear: z.number().int(),
    expectedCompletion: MonthSchema.nullable(),
    period: z.string().min(1),
    focus: z.string().min(1).optional(),
  })
  .refine((entry) => entry.startYear === null || entry.startYear <= entry.endYear, {
    message: 'Education must end on or after its start year',
  });

export const CompanyLinkCopySchema = z.object({ disclosure: z.string().min(1) });

export const GitCommitSchema = z
  .object({
    startMonth: MonthSchema,
    endMonth: MonthSchema.nullable(),
    location: z.string().min(1),
    workMode: z.enum(['remote', 'hybrid', 'on-site']).nullable(),
    domain: z.string().min(1),
    hash: z.string().min(1),
    deco: z.string().min(1),
    date: z.string().min(1),
    branch: z.string().min(1),
    type: z.enum(['career', 'life']),
    company: z.string().min(1),
    companyUrl: CompanyUrlSchema.optional(),
    role: z.string().min(1),
    body: z.array(z.string().min(1)),
    context: z.string().min(1).optional(),
    highlights: z.array(z.string().min(1)).default([]),
    isRoot: z.boolean().optional(),
  })
  .refine((entry) => entry.endMonth === null || entry.startMonth <= entry.endMonth, {
    message: 'Employment must end on or after its start month',
  });

export const BrandSchema = z.object({
  homeHref: z.string().startsWith('/'),
  accessibleName: z.string().min(1),
});
export type Brand = z.infer<typeof BrandSchema>;

export type HeroContent = z.infer<typeof HeroContentSchema>;

export const HeroClientContentSchema = z.object({
  systemFailurePlate: z.string().min(1),
  bootStaticDialogLine: z.string().min(1),
  bootSequenceLine: z.string().min(1),
  bootPrompt: z.string().min(1),
  bootCommand: z.string().min(1),
  bootSteps: z
    .array(z.object({ label: z.string().min(1), status: z.enum(['ok', 'encrypted']) }))
    .min(1),
  bootStatus: z.object({ ok: z.string().min(1), encrypted: z.string().min(1) }),
  bootWelcome: z.string().min(1),
  bootDialogDesktop: z.array(z.string().min(1)).min(1),
  bootDialogMobile: z.array(z.string().min(1)).min(1),
});
export type HeroClientContent = z.infer<typeof HeroClientContentSchema>;

export const DmesgLineSchema = z.object({
  off: z.number(),
  prefix: z.string().min(1),
  bold: z.string().min(1).optional(),
  suffix: z.string().min(1).optional(),
  ok: z.boolean(),
});
export type DmesgLine = z.infer<typeof DmesgLineSchema>;

const AskFactLinesSchema = z.array(z.string().min(1)).min(1);

export const AskDecisionSchema = z.object({
  decision: z.string().min(1),
  rejected: z.string().min(1),
  because: z.string().min(1),
});

export const AskStorySchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
});

export const AskFactsSchema = z.object({
  openTo: z.string().min(1),
  coreStack: AskFactLinesSchema,
  currentRoleScope: AskFactLinesSchema,
  currentRoleDetail: AskFactLinesSchema,
  targeting: AskFactLinesSchema,
  workingStyle: AskFactLinesSchema,
  decisions: z.array(AskDecisionSchema).min(1),
  stories: z.array(AskStorySchema).min(1),
  opinions: AskFactLinesSchema,
  calibration: AskFactLinesSchema,
  community: AskFactLinesSchema,
  projectDetail: AskFactLinesSchema,
});

export type AskFacts = z.infer<typeof AskFactsSchema>;

export type Social = z.infer<typeof SocialSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type PerfReceipt = z.infer<typeof PerfReceiptSchema>;
export type HottestTake = z.infer<typeof HottestTakeSchema>;
export type Responsibility = z.infer<typeof ResponsibilitySchema>;
export type GuitarRig = z.infer<typeof GuitarRigSchema>;
export type UnknownItem = z.infer<typeof UnknownItemSchema>;
export type Unknowns = z.infer<typeof UnknownsSchema>;
export type Credential = z.infer<typeof CredentialSchema>;
export type CommunityEvent = z.infer<typeof CommunityEventSchema>;
export type GitCommit = z.infer<typeof GitCommitSchema>;

export type Profile = z.infer<typeof ProfileSchema> & { technologyLine: string };
export type Education = z.infer<typeof EducationSchema>;
