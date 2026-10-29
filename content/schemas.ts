import { z } from 'zod';

export const SECTION_DESTINATION_COUNT = 9;
const FIRST_SECTION_ORDER = 1;
const MIN_SECTION_TEXT_LENGTH = 1;

export const SECTION_ICONS = {
  home: 'home',
  about: 'readme',
  projects: 'projects',
  career: 'git-log',
  shell: 'shell',
  measured: 'live-perf',
  opinions: 'hottest-takes',
  guitar: 'guitar',
  contact: 'contact',
} as const;

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
  label: SectionTextSchema,
  srLabel: SectionTextSchema,
  aliases: z.array(SectionAliasSchema).min(MIN_SECTION_TEXT_LENGTH).readonly(),
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
  company: z.string().min(1),
  name: z.string().min(1),
  mobileName: z.string().min(1),
  description: z.string().min(1),
  mobileDescription: z.string().min(1),
  stats: z.array(StatSchema).min(1),
  mobileMeta: z.array(StatSchema).min(1),
  perm: z.string().min(1).optional(),
});

export const PerfReceiptSchema = z.object({
  metric: z.string().min(1),
  delta: z
    .string()
    .regex(
      /^[+-]\d+(\.\d+)?%$/,
      'a perf receipt delta must be a bare signed percentage and nothing else: "-52%", "+10%", "-97.5%". __tests__/metric-consistency.test.ts flips the sign and searches every public surface for the resulting string, so the delta has to be a token a surface can literally contain. A trailing gloss ("-40% build time") or a missing sign ("10%") flips to a string no surface holds — the sweep for that metric then silently passes forever instead of failing. Put the gloss in `note`. The sibling idiom lives one import away in lib/hiring-profile.ts ("-97.5% (40s→<1s, Venturus)"); that field is a plain string and is compared by prefix, this one is not.',
    ),
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

export const WORK_AUTH_STATUS = {
  citizen: 'CITIZEN',
  needsSponsorship: 'NEEDS_SPONSORSHIP',
  openWithSponsorship: 'OPEN_WITH_SPONSORSHIP',
} as const;

export const VisaRowSchema = z.object({
  jurisdiction: z.string().min(1),
  jurisdictionShort: z.string().min(1),
  status: z.enum(WORK_AUTH_STATUS),
  statusShort: z.enum(WORK_AUTH_STATUS),
  evidence: z.string().min(1),
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
  links: z.array(z.object({ label: z.string().min(1), href: z.url() })).min(1),
  refsLabel: z.string().min(1),
  newTabLabel: z.string().min(1),
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

const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const ProfileSchema = z.object({
  fullName: z.string().min(1),
  displayName: z.string().min(1),
  title: z.string().min(1),
  technologyLine: z.string().min(1),
  country: z.string().min(1),
  city: z.string().min(1),
  timezone: z.string().min(1),
  availability: z.string().min(1),
  currentEmployer: z.object({ name: z.string().min(1), context: z.string().min(1) }),
  languages: z
    .array(z.object({ code: z.string().min(1), name: z.string().min(1), level: z.string().min(1) }))
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
  })
  .refine((entry) => entry.startYear === null || entry.startYear <= entry.endYear, {
    message: 'Education must end on or after its start year',
  });

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

const FooterHrefSchema = z.string().regex(/^(?:#[\w-]+|\/(?!\/)[\w/-]*|https:\/\/[^\s]+)$/);
const FooterLinkSchema = z.object({ label: z.string().min(1), href: FooterHrefSchema });

export const FooterContentSchema = z.object({
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
  copyLabel: z.string().min(1),
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
});
export type FooterContent = z.infer<typeof FooterContentSchema>;

const ErrorHrefSchema = z.string().regex(/^\/(?!\/)[\w/#-]*$/);
const ErrorLinkSchema = z.object({ label: z.string().min(1), href: ErrorHrefSchema });

export const ErrorsContentSchema = z.object({
  chrome: z.object({
    brand: z.string().min(1),
    brandHref: ErrorHrefSchema,
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
  noscript: z.object({ text: z.string().min(1) }),
});
export type ErrorsContent = z.infer<typeof ErrorsContentSchema>;
export const ErrorsClientContentSchema = ErrorsContentSchema.pick({
  chrome: true,
  serverError: true,
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

export const LocalizedTextSchema = z.object({
  pt: z.string().min(1),
  en: z.string().min(1),
});

export const LinksProfileSchema = z.object({
  name: z.string().min(1),
  avatar: z.string().min(1),
  title: LocalizedTextSchema,
  host: LocalizedTextSchema,
  stack: z.string().min(1),
  status: LocalizedTextSchema,
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
  statusLabel: LocalizedTextSchema,
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
  skipToContent: LocalizedTextSchema,
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
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;
export type LinksProfile = z.infer<typeof LinksProfileSchema>;
export type LinksChannel = z.infer<typeof LinksChannelSchema>;
export type LinksPlaylist = z.infer<typeof LinksPlaylistSchema>;
export type LinksPill = z.infer<typeof LinksPillSchema>;
export type LinksCopy = z.infer<typeof LinksCopySchema>;
export type LinksContent = z.infer<typeof LinksContentSchema>;

export type Profile = z.infer<typeof ProfileSchema>;
export type Education = z.infer<typeof EducationSchema>;

const ReadingTextSchema = z.string().min(1);
const ReadingLinkSchema = z.object({ label: ReadingTextSchema, href: ReadingTextSchema });

export const ReadingViewsSchema = z.object({
  shared: z.object({
    skipLabel: ReadingTextSchema,
    homeLabel: ReadingTextSchema,
    navLabel: ReadingTextSchema,
    nav: z.array(ReadingLinkSchema).min(1),
    hire: z.object({
      label: ReadingTextSchema,
      ariaLabel: ReadingTextSchema,
      href: z.url(),
    }),
    printLabel: ReadingTextSchema,
    newTabRel: ReadingTextSchema,
    newTabHint: ReadingTextSchema,
    homeHref: z.string().startsWith('/'),
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
      workAuthorization: ReadingTextSchema,
      contact: ReadingTextSchema,
    }),
    credentialLabels: z.record(z.string(), ReadingTextSchema),
    proseOverrides: z.record(z.string(), ReadingTextSchema),
  }),
  summary: z.object({
    path: z.string().startsWith('/'),
    title: ReadingTextSchema,
    description: ReadingTextSchema,
    cvLinkLabel: ReadingTextSchema,
    statsLabel: ReadingTextSchema,
    experienceLabel: ReadingTextSchema,
    badge: ReadingTextSchema,
    projectNames: z.array(ReadingTextSchema).min(1),
    stack: z.array(ReadingTextSchema).min(1),
    headings: z.object({
      projects: ReadingTextSchema,
      workAuthorization: ReadingTextSchema,
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
  authorization: z.array(ReadingRowSchema).min(1),
  languages: ReadingTextSchema,
  email: ReadingTextSchema,
});

export const SummaryDocumentSchema = z.object({
  name: ReadingTextSchema,
  tagline: ReadingTextSchema,
  technologyLine: ReadingTextSchema,
  context: ReadingTextSchema,
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
  authorization: z
    .array(
      z
        .object({
          jurisdiction: ReadingTextSchema,
          status: ReadingTextSchema,
          evidence: ReadingTextSchema,
        })
        .passthrough(),
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
  }),
});
