import { z } from 'zod';
import { SECTION_ICONS } from './section-registry';

export { SECTION_ICONS };
export const SECTION_DESTINATION_COUNT = 9;
const FIRST_SECTION_ORDER = 1;
const MIN_SECTION_TEXT_LENGTH = 1;
const MIN_ALIAS_COUNT = 1;

export const CompanyUrlSchema = z.url({ protocol: /^https$/ });

export const LocalizedTextSchema = z.object({
  pt: z.string().min(1),
  en: z.string().min(1),
});
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

const SectionTextSchema = z
  .string()
  .min(MIN_SECTION_TEXT_LENGTH)
  .refine((text) => text === text.trim(), {
    message: 'Section text must not have leading or trailing whitespace',
  });

const SectionAliasSchema = SectionTextSchema.refine((alias) => alias === alias.toLowerCase(), {
  message: 'Section aliases must be lowercase',
});

export const SectionSchema = z.object({
  id: SectionTextSchema,
  label: LocalizedTextSchema,
  srLabel: LocalizedTextSchema,
  aliases: z.array(SectionAliasSchema).min(MIN_ALIAS_COUNT).readonly(),
  order: z.number().int().min(FIRST_SECTION_ORDER).max(SECTION_DESTINATION_COUNT),
  icon: z.enum(SECTION_ICONS),
});

export type Section = z.infer<typeof SectionSchema>;

export const SectionRegistrySchema = z
  .array(SectionSchema)
  .length(SECTION_DESTINATION_COUNT)
  .refine((entries) => new Set(entries.map(({ id }) => id)).size === entries.length, {
    message: 'Section ids must be unique',
  })
  .refine((entries) => new Set(entries.map(({ order }) => order)).size === entries.length, {
    message: 'Section orders must be unique',
  })
  .refine((entries) => entries.every(({ order }, index) => order === FIRST_SECTION_ORDER + index), {
    message: 'Section orders must match array position and be contiguous from the first order',
  })
  .refine(
    (entries) => {
      const aliases = entries.flatMap(({ aliases }) => aliases);
      return new Set(aliases).size === aliases.length;
    },
    { message: 'Section aliases must be unique across all destinations' },
  )
  .readonly();

const DOCK_KEYS = ['home', 'work', 'shell', 'hire', 'menu'] as const;
const MENU_DOCK_KEY = 'menu';
const MIN_NAV_ITEMS = 1;

const NavTextSchema = SectionTextSchema;

const NavGroupSchema = z.object({
  id: NavTextSchema,
  title: NavTextSchema,
  dock: z.enum(DOCK_KEYS),
  sectionIds: z.array(NavTextSchema).min(MIN_NAV_ITEMS).readonly(),
});

const DockControlSchema = z
  .object({
    key: z.enum(DOCK_KEYS),
    label: NavTextSchema,
    sectionId: NavTextSchema.optional(),
    href: z.string().url().optional(),
    accessibleName: NavTextSchema.optional(),
  })
  .refine(
    ({ key, sectionId, href }) =>
      key === MENU_DOCK_KEY ? !sectionId && !href : Boolean(sectionId) !== Boolean(href),
    {
      message:
        'A dock control targets exactly one section or one link; the menu control targets neither',
    },
  );

const SiteLinkSchema = z.object({
  label: NavTextSchema,
  index: NavTextSchema,
  href: z.string().regex(/^(\/(?!\/)\S*|https:\/\/\S+)$/),
  external: z.boolean(),
  accessibleName: NavTextSchema.optional(),
});

const NavigationCopySchema = z.object({
  drawerLabel: NavTextSchema,
  navLabel: NavTextSchema,
  title: NavTextSchema,
  openMenu: NavTextSchema,
  closeDrawer: NavTextSchema,
  dockLabel: NavTextSchema,
  motionOn: NavTextSchema,
  motionOff: NavTextSchema,
  motionReduced: NavTextSchema,
  langSwitchLabel: NavTextSchema,
  skipLabel: NavTextSchema,
  siteNavLabel: NavTextSchema,
  backToTopLabel: NavTextSchema,
});

export function createNavigationSchema(sectionIds: readonly string[]) {
  return z
    .object({
      copy: NavigationCopySchema,
      groups: z.array(NavGroupSchema).min(MIN_NAV_ITEMS).readonly(),
      dock: z.array(DockControlSchema).min(MIN_NAV_ITEMS).readonly(),
      siteLinks: z.array(SiteLinkSchema).readonly(),
    })
    .superRefine(({ groups, dock }, ctx) => {
      const grouped = groups.flatMap(({ sectionIds: members }) => members);
      if (grouped.join('|') !== sectionIds.join('|')) {
        ctx.addIssue({
          code: 'custom',
          message:
            'Navigation groups must list every registry section exactly once, in registry order',
        });
      }
      const dockKeys = dock.map(({ key }) => key);
      if (new Set(dockKeys).size !== dockKeys.length) {
        ctx.addIssue({ code: 'custom', message: 'Dock control keys must be unique' });
      }
      if (!dockKeys.includes(MENU_DOCK_KEY)) {
        ctx.addIssue({ code: 'custom', message: 'The dock needs a menu control' });
      }
      for (const { dock: key } of groups) {
        if (!dockKeys.includes(key)) {
          ctx.addIssue({
            code: 'custom',
            message: `Group points at missing dock control "${key}"`,
          });
        }
      }
      for (const { sectionId } of dock) {
        if (sectionId && !sectionIds.includes(sectionId)) {
          ctx.addIssue({ code: 'custom', message: `Dock targets unknown section "${sectionId}"` });
        }
      }
    });
}

export const SocialSchema = z.object({
  github: z.string().url(),
  githubLabel: z.string().min(1),
  linkedin: z.string().url(),
  linkedinLabel: z.string().min(1),
  email: z.string().email(),
  site: z.string().url(),
  siteLabel: z.string().min(1),
  handle: z.string().min(1),
  whatsapp: z.string().url(),
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
    url: z.string().url().optional(),
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
    url: z.string().url(),
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
    url: z.string().url(),
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

export const EQ_TEMPLATE_TOKENS = { freq: '{freq}', gain: '{gain}' } as const;
export const EQ_DEFAULT_PEAK_Q = 0.8;
export const EQ_MIN_BAR_COUNT = 8;
export const EQ_MAX_BAR_COUNT = 144;

const eqFreqSchema = z.number().positive();

export const EqBandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('highpass'), freqHz: eqFreqSchema }),
  z.object({ kind: z.literal('lowpass'), freqHz: eqFreqSchema }),
  z.object({
    kind: z.literal('peak'),
    freqHz: eqFreqSchema,
    gainDb: z.number(),
    q: z.number().positive().default(EQ_DEFAULT_PEAK_Q),
  }),
]);
export type EqBand = z.infer<typeof EqBandSchema>;

const eqTemplate = (...tokens: string[]) =>
  tokens.reduce((schema, token) => schema.includes(token), z.string().trim().nonempty());

export const EqSpectrumSchema = z
  .object({
    label: z.string().trim().nonempty(),
    ariaLabel: z.object({
      prefix: z.string().trim().nonempty(),
      highpass: eqTemplate(EQ_TEMPLATE_TOKENS.freq),
      lowpass: eqTemplate(EQ_TEMPLATE_TOKENS.freq),
      boost: eqTemplate(EQ_TEMPLATE_TOKENS.freq, EQ_TEMPLATE_TOKENS.gain),
      cut: eqTemplate(EQ_TEMPLATE_TOKENS.freq, EQ_TEMPLATE_TOKENS.gain),
    }),
    bpm: z.number().positive(),
    barCount: z.number().int().min(EQ_MIN_BAR_COUNT).max(EQ_MAX_BAR_COUNT),
    freqRange: z.object({ minHz: eqFreqSchema, maxHz: eqFreqSchema }),
    bands: z.array(EqBandSchema).min(1),
    axis: z.array(z.object({ freqHz: eqFreqSchema, label: z.string().trim().nonempty() })).min(2),
  })
  .superRefine(({ freqRange, bands, axis }, ctx) => {
    const { minHz, maxHz } = freqRange;
    const inRange = (freqHz: number) => freqHz >= minHz && freqHz <= maxHz;
    if (minHz >= maxHz) {
      ctx.addIssue({ code: 'custom', path: ['freqRange'], message: 'minHz must be below maxHz' });
    }
    for (const [index, band] of bands.entries()) {
      if (!inRange(band.freqHz)) {
        ctx.addIssue({ code: 'custom', path: ['bands', index], message: 'band outside range' });
      }
    }
    for (const [index, tick] of axis.entries()) {
      if (!inRange(tick.freqHz)) {
        ctx.addIssue({ code: 'custom', path: ['axis', index], message: 'tick outside range' });
      }
      if (index > 0 && tick.freqHz <= (axis[index - 1]?.freqHz ?? 0)) {
        ctx.addIssue({ code: 'custom', path: ['axis', index], message: 'ticks must ascend' });
      }
    }
  });
export type EqSpectrum = z.infer<typeof EqSpectrumSchema>;

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
  scrollLabel: z.string().min(1),
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
    context: z.string().min(1),
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
        href: z.union([z.string().url().startsWith('https://'), z.string().regex(/^\/(?!\/)\S*$/)]),
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
    companyUrl: CompanyUrlSchema,
    role: z.string().min(1),
    body: z.array(z.string().min(1)),
    isRoot: z.boolean().optional(),
  })
  .refine((entry) => entry.endMonth === null || entry.startMonth <= entry.endMonth, {
    message: 'Employment must end on or after its start month',
  });

export const ShellResponseSchema = z.object({
  commands: z.array(z.string().min(1)).min(1),
  kind: z.enum(['output', 'error']).default('output'),
  text: z.string().min(1),
});
export const ShellCommandsSchema = z.array(ShellResponseSchema).min(1);

export const ShellUiSchema = z.object({
  welcome: z.string().min(1),
  mobileWelcome: z.string().min(1),
  inputLabel: z.string().min(1),
  outputLabel: z.string().min(1),
  toolbarLabel: z.string().min(1),
  prompt: z.string().min(1),
  placeholder: z.string().min(1),
  commandHint: z.string().min(1),
  aiLabel: z.string().min(1),
  thinking: z.string().min(1),
  stop: z.string().min(1),
  stopLabel: z.string().min(1),
  stoppedBefore: z.string().min(1),
  stoppedPartial: z.string().min(1),
  started: z.string().min(1),
  complete: z.string().min(1),
  commandComplete: z.string().min(1),
  cleared: z.string().min(1),
  busy: z.string().min(1),
  empty: z.string().min(1),
  errorPrefix: z.string().min(1),
  httpErrorPrefix: z.string().min(1),
  bodyUnavailable: z.string().min(1),
  offline: z.string().min(1),
  networkError: z.string().min(1),
  timeout: z.string().min(1),
  localAvailable: z.string().min(1),
  referencePrefix: z.string().min(1),
  copy: z.string().min(1),
  copied: z.string().min(1),
  copyFailed: z.string().min(1),
  copiedAnnouncement: z.string().min(1),
  copyFailedAnnouncement: z.string().min(1),
  accuracy: z.string().min(1),
  privacy: z.string().min(1),
  email: z.string().min(1).email(),
  emailHref: z.string().min(1).url(),
  technicalPrivacy: z.string().min(1),
  requestIdHeader: z.string().min(1),
  technicalPrivacySuffix: z.string().min(1),
  forgetEndpoint: z.string().min(1),
  suggestions: z.array(z.string().min(1)).min(1),
  commands: z.array(z.string().min(1)).min(1),
});
export type ShellUi = z.infer<typeof ShellUiSchema>;

export const TerminalChromeSchema = z.object({
  promptLabel: z.string().min(1),
  rightTag: z.string().min(1),
  mobileLabel: z.string().min(1).optional(),
});
export type TerminalChrome = z.infer<typeof TerminalChromeSchema>;

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
});
export type HeroClientContent = z.infer<typeof HeroClientContentSchema>;

const FooterHrefSchema = z.string().regex(/^(?:#[\w-]+|\/(?!\/)[\w/-]*|https:\/\/[^\s]+)$/);
const FooterLinkSchema = z.object({ label: z.string().min(1), href: FooterHrefSchema });

export const FooterContentSchema = z
  .object({
    shutdownTitle: z.string().min(1),
    prompt: z.string().min(1),
    shutdownCommand: z.string().min(1),
    sessionTitle: z.string().min(1),
    sessionLabels: z.object({
      user: z.string().min(1),
      uptime: z.string().min(1),
      depth: z.string().min(1),
      seen: z.string().min(1),
      commands: z.string().min(1),
    }),
    user: z.string().min(1),
    netstatTitle: z.string().min(1),
    externalGlyph: z.string().min(1),
    connectionLabels: z.object({
      protocol: z.string().min(1),
      state: z.string().min(1),
      endpoint: z.string().min(1),
    }),
    connections: z
      .array(
        FooterLinkSchema.extend({
          protocol: z.literal('tcp'),
          state: z.enum(['ESTABLISHED', 'LISTEN']),
          external: z.boolean(),
        }),
      )
      .min(1),
    treeTitle: z.string().min(1),
    treeLabel: z.string().min(1),
    fileCount: z.object({ one: z.string().min(1), other: z.string().min(1) }),
    treeOpenDirectory: z.string().min(1),
    groups: z
      .array(
        z.object({
          directory: z.string().regex(/^\.\/[a-z_]+\/$/),
          links: z.array(FooterLinkSchema).min(1),
        }),
      )
      .length(6),
    halted: z.string().min(1),
    haltedAt: z.string().min(1),
    reboot: z.object({
      label: z.string().min(1),
      before: z.string().min(1),
      key: z.string().length(1),
      after: z.string().min(1),
      announcement: z.string().min(1),
    }),
    copyright: z.string().min(1),
  })
  .refine((footer) => footer.groups.some((group) => group.directory === footer.treeOpenDirectory), {
    message: 'treeOpenDirectory must name one of the site map groups',
    path: ['treeOpenDirectory'],
  });
export type FooterContent = z.infer<typeof FooterContentSchema>;

const ErrorHrefSchema = z.string().regex(/^\/(?!\/)[\w/#-]*$/);
const ErrorLinkSchema = z.object({ label: z.string().min(1), href: ErrorHrefSchema });

export const ErrorsContentSchema = z.object({
  chrome: z.object({
    navLabel: z.string().min(1),
    skipLabel: z.string().min(1),
    nav: z.array(ErrorLinkSchema).min(1),
  }),
  notFound: z.object({
    metaTitle: z.string().min(1),
    code: z.literal('404'),
    panelHeader: z.string().min(1),
    prompt: z.string().min(1),
    command: z.string().min(1),
    output: z.string().min(1),
    suggestionsLabel: z.string().min(1),
    suggestionsNavLabel: z.string().min(1),
    suggestions: z.array(ErrorLinkSchema).min(1),
    home: ErrorLinkSchema,
  }),
  serverError: z.object({
    code: z.literal('500'),
    message: z.string().min(1),
    retryLabel: z.string().min(1),
    home: ErrorLinkSchema,
    refLabel: z.string().min(1),
    copyLabel: z.string().min(1),
    copyAriaLabel: z.string().min(1),
    copiedAnnouncement: z.string().min(1),
  }),
  noscript: z.object({ text: z.string().min(1), contact: ErrorLinkSchema }),
  componentUnavailable: z.string().min(1),
});
export type ErrorsContent = z.infer<typeof ErrorsContentSchema>;
export const ErrorsClientContentSchema = ErrorsContentSchema.pick({
  chrome: true,
  serverError: true,
  componentUnavailable: true,
});
export type ErrorsClientContent = z.infer<typeof ErrorsClientContentSchema>;

export const DmesgLineSchema = z.object({
  off: z.number(),
  prefix: z.string().min(1),
  bold: z.string().min(1).optional(),
  suffix: z.string().min(1).optional(),
  ok: z.boolean(),
});
export type DmesgLine = z.infer<typeof DmesgLineSchema>;

export const CopyFeedbackSchema = z.object({ label: z.string().min(1), message: z.string() });
export type CopyFeedback = z.infer<typeof CopyFeedbackSchema>;
export type CopyFeedbackState = 'idle' | 'success' | 'failure' | 'unavailable';

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
  loadingLabel: z.string().min(1),
  bpm: z.number().int(),
  timeSignature: z.string().min(1),
  status: z.string().min(1),
  transportTime: z.string().min(1),
  channels: z
    .array(DawMixerChannelSchema)
    .length(3)
    .refine((chs) => chs[chs.length - 1]?.id === 'MASTER', {
      message: 'Last channel must be MASTER',
    }),
});

const DawMixerCopyTextSchema = z.string().min(1);

export const DawMixerCopySchema = z.object({
  sessionLabel: DawMixerCopyTextSchema,
  tracksLabel: DawMixerCopyTextSchema,
  separator: DawMixerCopyTextSchema,
  transportSeparator: DawMixerCopyTextSchema,
  playGlyph: DawMixerCopyTextSchema,
  bpmUnit: DawMixerCopyTextSchema,
  signalFlow: DawMixerCopyTextSchema,
  leadSuffix: DawMixerCopyTextSchema,
  loudnessLabel: DawMixerCopyTextSchema,
  peakLabel: DawMixerCopyTextSchema,
  decibelUnit: DawMixerCopyTextSchema,
  columns: z.object({
    id: DawMixerCopyTextSchema,
    track: DawMixerCopyTextSchema,
    io: DawMixerCopyTextSchema,
    toggles: DawMixerCopyTextSchema,
    pluginChain: DawMixerCopyTextSchema,
    meter: DawMixerCopyTextSchema,
    fader: DawMixerCopyTextSchema,
  }),
});

export const LinksProfileSchema = z.object({
  name: z.string().min(1),
  avatar: z.string().min(1),
  taglines: z.object({
    pt: z.array(z.string().min(1)).min(1),
    en: z.array(z.string().min(1)).min(1),
  }),
  host: LocalizedTextSchema,
  stack: z.string().min(1),
});

export const LinksChannelSchema = z.object({
  id: z
    .string()
    .regex(
      /^UC[A-Za-z0-9_-]{22}$/,
      'a YouTube channel id is "UC" plus 22 url-safe chars. The RSS feed at /feeds/videos.xml?channel_id= is keyed on this and returns a bare feed with no <entry> elements for a wrong id, which reads exactly like a channel with no videos: the page would render its empty state forever instead of failing.',
    ),
  handle: z.string().regex(/^@[A-Za-z0-9._-]+$/, 'a channel handle starts with @'),
  name: z.string().min(1),
});

export const LinksPlaylistSchema = z.object({
  id: z.string().min(1),
  accent: z.enum(['quaternary', 'quinary']),
  tag: z.string().min(1),
  title: LocalizedTextSchema,
  description: LocalizedTextSchema,
  playlistId: z.string().min(1).optional(),
});

export const LinksPillSchema = z.object({
  id: z.string().min(1),
  icon: z.enum(['portfolio', 'github', 'linkedin', 'instagram', 'tiktok', 'email']),
  label: LocalizedTextSchema,
  href: z
    .string()
    .min(
      1,
      'an empty href is a dead pill: omit the field entirely instead. A pill with no href is filtered out of the footer by LinksFooter, which is how a destination nobody has confirmed yet stays off a public page rather than shipping as a guessed handle.',
    )
    .optional(),
});

export const LinksUpcomingSchema = z.object({
  label: LocalizedTextSchema,
  topic: LocalizedTextSchema,
  slot: LocalizedTextSchema,
});

export const LinksCopySchema = z.object({
  whoami: z.string().min(1),
  hostLabel: LocalizedTextSchema,
  stackLabel: LocalizedTextSchema,
  channelHeading: LocalizedTextSchema,
  videosWord: LocalizedTextSchema,
  viewsWord: LocalizedTextSchema,
  latestHeading: LocalizedTextSchema,
  historyCommand: z.string().min(1),
  historyEmpty: LocalizedTextSchema,
  thumbPlaceholder: LocalizedTextSchema,
  seeAllVideos: LocalizedTextSchema,
  playlistsHeading: LocalizedTextSchema,
  qrHeading: LocalizedTextSchema,
  qrCommand: z.string().min(1),
  qrBody: LocalizedTextSchema,
  subscribe: LocalizedTextSchema,
  subscribedCta: LocalizedTextSchema,
  watch: LocalizedTextSchema,
  copyLink: LocalizedTextSchema,
  copyDone: z.string().min(1),
  copyFailed: z.string().min(1),
  opensInNewTab: LocalizedTextSchema,
  newBadge: LocalizedTextSchema,
  langSwitchLabel: LocalizedTextSchema,
  feedUnavailable: LocalizedTextSchema,
  pageHeading: LocalizedTextSchema,
});

export const LinksContentSchema = z.object({
  shellTitle: z.string().min(1),
  siteUrl: z.string().url(),
  siteLabel: z.string().min(1),
  profile: LinksProfileSchema,
  channel: LinksChannelSchema,
  upcoming: LinksUpcomingSchema,
  playlists: z.array(LinksPlaylistSchema).min(1),
  pills: z.array(LinksPillSchema).min(1),
  copy: LinksCopySchema,
  meta: z.object({
    title: LocalizedTextSchema,
    description: LocalizedTextSchema,
  }),
});

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
export type ShellResponse = z.infer<typeof ShellResponseSchema>;
export type DawMixer = z.infer<typeof DawMixerSchema>;
export type DawMixerCopy = z.infer<typeof DawMixerCopySchema>;
export type DawMixerChannel = z.infer<typeof DawMixerChannelSchema>;
export type DawMixerPlugin = z.infer<typeof DawMixerPluginSchema>;
export type LinksProfile = z.infer<typeof LinksProfileSchema>;
export type LinksChannel = z.infer<typeof LinksChannelSchema>;
export type LinksPlaylist = z.infer<typeof LinksPlaylistSchema>;
export type LinksPill = z.infer<typeof LinksPillSchema>;
export type LinksCopy = z.infer<typeof LinksCopySchema>;
export type LinksContent = z.infer<typeof LinksContentSchema>;

export type Profile = z.infer<typeof ProfileSchema> & { technologyLine: string };
export type Education = z.infer<typeof EducationSchema>;

const ReadingTextSchema = z.string().min(1);

export const ReadingViewsSchema = z.object({
  shared: z.object({
    hire: z.object({
      label: ReadingTextSchema,
      ariaLabel: ReadingTextSchema,
      href: z.url(),
    }),
    printLabel: ReadingTextSchema,
    newTabHint: ReadingTextSchema,
    ogImage: z.object({ path: z.string().startsWith('/'), width: z.number(), height: z.number() }),
  }),
  cv: z.object({
    path: z.string().startsWith('/'),
    title: ReadingTextSchema,
    description: ReadingTextSchema,
    summaryLinkLabel: ReadingTextSchema,
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
    proseOverrides: z.record(z.string(), ReadingTextSchema),
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
        companyUrl: CompanyUrlSchema,
        meta: ReadingTextSchema,
        bullets: z.array(ReadingTextSchema).min(1),
      }),
    )
    .min(1),
  skills: z.array(ReadingTextSchema).min(1),
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

const LATITUDE_LIMIT = 90;
const LONGITUDE_LIMIT = 180;
const FULL_CIRCLE_DEGREES = 360;
const LAND_ROW_PATTERN = /^[01]+$/;

const LatitudeSchema = z.number().min(-LATITUDE_LIMIT).max(LATITUDE_LIMIT);
const LongitudeSchema = z.number().min(-LONGITUDE_LIMIT).max(LONGITUDE_LIMIT);

export const WorldMapSchema = z
  .object({
    grid: z.object({
      columns: z.number().int().positive(),
      rows: z.number().int().positive(),
      cellPx: z.number().positive(),
      degreesPerColumn: z.number().positive(),
      topLatitude: LatitudeSchema,
      bottomLatitude: LatitudeSchema,
    }),
    land: z.array(z.string().regex(LAND_ROW_PATTERN)),
    erikPin: z.object({
      place: z.string().min(1),
      code: z.string().min(1),
      lat: LatitudeSchema,
      lon: LongitudeSchema,
    }),
    knownZones: z.record(
      z.string().min(1),
      z.object({
        country: z.string().min(1),
        code: z.string().min(1),
        lat: LatitudeSchema,
        lon: LongitudeSchema,
      }),
    ),
  })
  .refine(({ grid, land }) => land.length === grid.rows, {
    message: 'land must have exactly grid.rows rows',
    path: ['land'],
  })
  .refine(({ grid, land }) => land.every((row) => row.length === grid.columns), {
    message: 'every land row must be grid.columns cells wide',
    path: ['land'],
  })
  .refine(({ grid }) => grid.columns * grid.degreesPerColumn === FULL_CIRCLE_DEGREES, {
    message: 'grid.columns times grid.degreesPerColumn must cover 360 degrees',
    path: ['grid', 'degreesPerColumn'],
  })
  .refine(
    ({ grid }) => grid.topLatitude - grid.bottomLatitude === grid.rows * grid.degreesPerColumn,
    {
      message: 'the latitude span must equal grid.rows times grid.degreesPerColumn',
      path: ['grid', 'bottomLatitude'],
    },
  );
export type WorldMap = z.infer<typeof WorldMapSchema>;
