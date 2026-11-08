import { describe, expect, it } from 'vitest';
import { SITE_LOCALE } from './site-locale';

const EN = SITE_LOCALE.en;
const guitarEqSpectrumFixture = {
  label: 'LEAD · Gretsch G5655TG → HX Stomp XL → IR cab → FOH',
  ariaLabel: {
    prefix: 'Live spectrum of the lead guitar under its EQ curve',
    highpass: 'high-pass at {freq}',
    lowpass: 'low-pass at {freq}',
    boost: '{gain} dB boost at {freq}',
    cut: '{gain} dB cut at {freq}',
  },
  bpm: 87,
  barCount: 72,
  freqRange: { minHz: 80, maxHz: 16000 },
  bands: [
    { kind: 'highpass', freqHz: 140 },
    { kind: 'peak', freqHz: 400, gainDb: -3, q: 0.8 },
    { kind: 'peak', freqHz: 2800, gainDb: 5, q: 0.8 },
    { kind: 'lowpass', freqHz: 9000 },
  ],
  axis: [
    { freqHz: 80, label: '80' },
    { freqHz: 200, label: '200' },
    { freqHz: 500, label: '500' },
    { freqHz: 1000, label: '1k' },
    { freqHz: 3000, label: '3k' },
    { freqHz: 8000, label: '8k' },
    { freqHz: 16000, label: '16k' },
  ],
};

const guitarSignalChainFixture = [
  {
    role: 'INPUT',
    label: '// INPUT',
    name: 'GRETSCH G5655TG',
    subtitle: 'Bigsby · hollow body',
    strengthDots: 4,
  },
  {
    role: 'AMP',
    label: '// AMP',
    name: 'MODELED CAB',
    subtitle: 'no tube · IR sim',
    strengthDots: 3,
  },
  {
    role: 'OUT',
    label: '// OUT',
    name: 'FOH / IEM',
    subtitle: 'XLR stereo · in-ear',
    strengthDots: 5,
  },
];

const guitarPresentationFixture = {
  signalStrengthLabelTemplate: '{n} of {total}',
  signalStrip: {
    live: '● SIGNAL_CHAIN.LIVE · SIGNAL OK',
    tail: 'TAIL -F ~/.RIG',
  },
  eqSpectrum: guitarEqSpectrumFixture,
  signalChain: guitarSignalChainFixture,
  influences: {
    label: 'INFLUENCES',
    text: "John Mayer · Mateus Asato · Jimmy Page · John Frusciante · Iron Maiden's three",
  },
  nowPlaying: { label: 'now obsessing:', text: 'Coldplay\'s "Yellow": simplicity is hard.' },
  stats: [
    { label: 'STYLE', value: 'dynamics > drive', sub: 'space is the note' },
    { label: 'TUNING', value: 'standard E', sub: 'sometimes drop D' },
    { label: 'ALT RIG', value: 'Martin', sub: 'acoustic' },
    { label: 'GIGS', value: 'venues', sub: 'church · wedding · open mic' },
  ],
  photo: {
    src: '/images/guitar-live.jpg',
    alt: 'Erik playing guitar on stage, live show',
    width: 450,
    height: 450,
  },
};

describe('GuitarPresentationSchema', () => {
  it('publishes the prototype presentation beside the rig', async () => {
    const { guitarPresentation, guitarRig } = await import('./guitar-rig');
    const { GuitarPresentationSchema } = await import('./schemas');
    expect(GuitarPresentationSchema.parse(guitarPresentation[EN])).toEqual(
      guitarPresentationFixture,
    );
    expect(guitarRig[EN].eqSpectrum).toEqual(guitarEqSpectrumFixture);
    expect(guitarRig[EN].signalChain.map((node) => node.role)).toEqual(['INPUT', 'AMP', 'OUT']);
  });

  it.each([
    ['reordered', [1, 0, 2]],
    ['missing', [0, 2]],
    ['extra', [0, 1, 1, 2]],
  ])('rejects %s display nodes', async (_, indices) => {
    const { GuitarPresentationSchema } = await import('./schemas');
    expect(
      GuitarPresentationSchema.safeParse({
        ...guitarPresentationFixture,
        signalChain: indices.map((index) => guitarSignalChainFixture[index]),
      }).success,
    ).toBe(false);
  });

  it.each([
    ['no bands', { bands: [] }],
    ['a zero bar count', { barCount: 0 }],
    ['a non-positive BPM', { bpm: 0 }],
    ['an inverted range', { freqRange: { minHz: 16000, maxHz: 80 } }],
    ['a band outside the range', { bands: [{ kind: 'lowpass', freqHz: 40000 }] }],
    ['an axis tick outside the range', { axis: [{ freqHz: 20, label: '20' }] }],
    [
      'a descending axis',
      {
        axis: [
          { freqHz: 200, label: '200' },
          { freqHz: 80, label: '80' },
        ],
      },
    ],
    ['an empty label', { label: '  ' }],
    [
      'a template without its frequency token',
      { ariaLabel: { ...guitarEqSpectrumFixture.ariaLabel, highpass: 'high-pass' } },
    ],
  ])('rejects an EQ spectrum with %s', async (_, override) => {
    const { EqSpectrumSchema } = await import('./schemas');
    expect(EqSpectrumSchema.safeParse({ ...guitarEqSpectrumFixture, ...override }).success).toBe(
      false,
    );
  });

  it('defaults a peak band quality factor', async () => {
    const { EqSpectrumSchema } = await import('./schemas');
    const parsed = EqSpectrumSchema.parse({
      ...guitarEqSpectrumFixture,
      bands: [{ kind: 'peak', freqHz: 400, gainDb: -3 }],
    });
    expect(parsed.bands[0]).toMatchObject({ kind: 'peak', q: 0.8 });
  });

  it.each(['width', 'height', 'src', 'alt'])('requires photo %s', async (field) => {
    const { GuitarPresentationSchema } = await import('./schemas');
    const photo: Record<string, unknown> = { ...guitarPresentationFixture.photo };
    delete photo[field];
    expect(
      GuitarPresentationSchema.safeParse({ ...guitarPresentationFixture, photo }).success,
    ).toBe(false);
  });

  it.each([
    { alt: '' },
    { alt: '   ' },
    { src: '' },
    { width: 0 },
    { height: -1 },
    { width: 1.5 },
    { height: 1.5 },
  ])('rejects invalid photo metadata %j', async (invalidPhoto) => {
    const { GuitarPresentationSchema } = await import('./schemas');
    expect(
      GuitarPresentationSchema.safeParse({
        ...guitarPresentationFixture,
        photo: { ...guitarPresentationFixture.photo, ...invalidPhoto },
      }).success,
    ).toBe(false);
  });
});

describe('GuitarRigSchema v2', () => {
  it('rejects old flat-fields shape', async () => {
    const { GuitarRigSchema } = await import('./schemas');
    expect(() =>
      GuitarRigSchema.parse({ fields: [], influences: [], influencesMobile: [] }),
    ).toThrow();
  });

  it('accepts the eqSpectrum + signalChain + influences + stats shape', async () => {
    const { GuitarRigSchema } = await import('./schemas');
    expect(() =>
      GuitarRigSchema.parse({
        eqSpectrum: guitarEqSpectrumFixture,
        signalChain: [
          { role: 'INPUT', name: 'TEST', subtitle: 'sub', strengthDots: 4 },
          { role: 'AMP', name: 'AMP', subtitle: 'sub', strengthDots: 3 },
          { role: 'OUT', name: 'OUT', subtitle: 'sub', strengthDots: 5 },
        ],
        influences: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }],
        stats: [
          { label: 'STYLE', value: 'feel', sub: 'lots' },
          { label: 'TUNING', value: 'standard', sub: 'drop D' },
          { label: 'ALT RIG', value: 'Martin', sub: 'acoustic' },
          { label: 'GIGS', value: 'small', sub: 'band' },
        ],
        liveCam: {
          photo: '/images/guitar-live.jpg',
          caption: './GIGS',
          status: '▶ REC',
          cameraLabel: 'CAM/01',
        },
      }),
    ).not.toThrow();
  });
});

const baseChannel = (id: string) => ({
  id,
  name: 'TEST',
  desc: 'test desc',
  plugins: [{ name: 'COMP', active: true, strength: 3 }],
  faderPct: 72,
  db: '-2.5',
  meterPct: 71,
  knob1: { label: 'GAIN', angleDeg: -30 },
  knob2: { label: 'PAN', angleDeg: 0 },
  buttons: ['R', 'M', 'S'],
  activeButtons: [],
});

const validThreeChannels = [
  baseChannel('CH 01'),
  baseChannel('CH 02'),
  { ...baseChannel('MASTER'), buttons: ['FX', 'EQ'] },
];

describe('DawMixerSchema', () => {
  it('accepts a valid 3-channel config with MASTER last', async () => {
    const { DawMixerSchema } = await import('./schemas');
    expect(() =>
      DawMixerSchema.parse({
        sessionName: 'TEST.ALS',
        loadingLabel: 'loading',
        bpm: 87,
        timeSignature: '4/4',
        status: 'MIXING',
        transportTime: '00:01:24:08',
        channels: validThreeChannels,
      }),
    ).not.toThrow();
  });

  it('rejects fewer than 3 channels', async () => {
    const { DawMixerSchema } = await import('./schemas');
    expect(() =>
      DawMixerSchema.parse({
        sessionName: 'TEST.ALS',
        loadingLabel: 'loading',
        bpm: 87,
        timeSignature: '4/4',
        status: 'MIXING',
        transportTime: '00:01:24:08',
        channels: validThreeChannels.slice(0, 2),
      }),
    ).toThrow();
  });

  it('rejects 3 channels when last is not MASTER', async () => {
    const { DawMixerSchema } = await import('./schemas');
    const noMaster = validThreeChannels.map((c) => ({
      ...c,
      id: c.id === 'MASTER' ? 'CH 03' : c.id,
    }));
    expect(() =>
      DawMixerSchema.parse({
        sessionName: 'TEST.ALS',
        loadingLabel: 'loading',
        bpm: 87,
        timeSignature: '4/4',
        status: 'MIXING',
        transportTime: '00:01:24:08',
        channels: noMaster,
      }),
    ).toThrow();
  });
});

const profileFixture = {
  fullName: 'Erik Henrique Alves Cunha',
  displayName: 'Erik Cunha',
  title: 'Senior Software Engineer, Applied AI',
  stackLine: 'TypeScript, Python, React, Next.js, Angular, Node.js, AWS',
  aiLine: 'LLM Systems, Evals, Agents, MCP, Guardrails',
  country: 'Brazil',
  city: 'Paulínia',
  timezone: 'UTC-3',
  availability: 'available now',
  currentEmployer: {
    name: 'Raylu',
    url: 'https://raylu.ai',
    contextFacts: ['AI deal origination', 'private markets'],
  },
  languages: [
    { code: 'pt', label: 'PT-BR', name: 'Portuguese', level: 'native' },
    { code: 'en', label: 'EN', name: 'English', level: 'C1' },
    { code: 'es', label: 'ES', name: 'Spanish', level: 'B1' },
    { code: 'fr', label: 'FR', name: 'French', level: 'A2' },
  ],
  actions: [{ label: 'GitHub ↗', href: 'https://github.com/erikunha' }],
};

const educationFixtures = [
  {
    id: 'MBA_AI_ENG',
    degree: 'MBA (Lato Sensu), AI Engineering, Machine Learning and Deep Learning',
    institution: 'Instituto Infnet',
    location: 'Brazil',
    studyMode: 'online',
    startYear: null,
    endYear: 2027,
    expectedCompletion: '2027-12',
    period: 'expected Dec 2027',
    focus: 'Coursework: ML and deep learning, LLMs, RAG, multi-agent systems, Python',
  },
  {
    id: 'CO_OP_DIPLOMA',
    degree: 'Web Development Co-op Diploma',
    institution: 'Cornerstone International Community College of Canada (CICCC)',
    location: 'Vancouver, Canada',
    studyMode: null,
    startYear: 2023,
    endYear: 2024,
    expectedCompletion: null,
    period: '2023-2024',
  },
  {
    id: 'BS_INFO_SYSTEMS',
    degree: 'B.S. Information Systems',
    institution: 'Centro Universitário Salesiano de São Paulo (UNISAL)',
    location: 'Campinas, Brazil',
    studyMode: null,
    startYear: 2015,
    endYear: 2020,
    expectedCompletion: null,
    period: '2015-2020',
  },
];

describe('canonical profile and education', () => {
  it('validates and publishes the approved profile fixture', async () => {
    const { ProfileSchema } = await import('./schemas');
    const { profile } = await import('./profile');
    expect(ProfileSchema.parse(profileFixture)).toEqual(profileFixture);
    expect(profile).toEqual({
      ...profileFixture,
      technologyLine: `${profileFixture.stackLine} · ${profileFixture.aiLine}`,
    });
  });

  it('rejects missing identity, invalid actions and missing language levels', async () => {
    const { ProfileSchema } = await import('./schemas');
    for (const invalid of [
      { ...profileFixture, title: '' },
      { ...profileFixture, country: '' },
      { ...profileFixture, actions: [{ label: 'CV', href: 'javascript:alert(1)' }] },
      { ...profileFixture, languages: [{ code: 'en', name: 'English' }] },
      {
        ...profileFixture,
        currentEmployer: { ...profileFixture.currentEmployer, contextFacts: [] },
      },
      {
        ...profileFixture,
        currentEmployer: { ...profileFixture.currentEmployer, contextFacts: [''] },
      },
      {
        ...profileFixture,
        currentEmployer: {
          ...profileFixture.currentEmployer,
          contextFacts: ['AI deal origination · private markets'],
        },
      },
    ])
      expect(ProfileSchema.safeParse(invalid).success).toBe(false);
  });

  it('validates and publishes three education fixtures separately from certifications', async () => {
    const { EducationSchema } = await import('./schemas');
    const { education } = await import('./education');
    expect(EducationSchema.array().parse(educationFixtures)).toEqual(educationFixtures);
    expect(education[SITE_LOCALE.en]).toEqual(educationFixtures);
    const { credentials } = await import('./credentials');
    expect(credentials).toEqual([
      { label: 'ANGULAR_DEV', badge: 'CERTIFIED', evidence: 'certificates.dev · 2024' },
      { label: 'ENGLISH', badge: 'IELTS_GENERAL_TRAINING', evidence: 'C1 · 2023' },
      { label: 'INTL_DEGREE', badge: 'WES_VERIFIED', evidence: 'World Education Services · 2022' },
    ]);
    const { communityEvent } = await import('./community');
    expect(communityEvent[EN].statusLine).toBe(
      'open to CFP submissions for 2027 · open to volunteer / organizer roles.',
    );
  });

  it('publishes one community event link and rejects one that is not an absolute URL', async () => {
    const { CommunityEventSchema } = await import('./schemas');
    const { communityEvent } = await import('./community');
    expect(CommunityEventSchema.parse(communityEvent[EN])).toEqual(communityEvent[EN]);
    const invalid = {
      ...communityEvent[EN],
      link: { ...communityEvent[EN].link, href: 'devopsdays.org' },
    };
    expect(
      CommunityEventSchema.safeParse(invalid).success,
      'the community link must be an absolute URL: Career renders it as an href and the JSON-LD publishes it as the organization url, so a relative value would ship a broken link',
    ).toBe(false);
  });

  it('rejects malformed expected months and reversed education dates', async () => {
    const { EducationSchema } = await import('./schemas');
    for (const invalid of [
      { ...educationFixtures[0], expectedCompletion: '2027-13' },
      { ...educationFixtures[0], institution: '' },
      { ...educationFixtures[1], startYear: 2025, endYear: 2024 },
    ])
      expect(EducationSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects malformed career months and reversed employment dates', async () => {
    const { GitCommitSchema } = await import('./schemas');
    const { gitLog } = await import('./git-log');
    for (const invalid of [
      { ...gitLog[EN][0], startMonth: '2026-13' },
      { ...gitLog[EN][0], startMonth: '2026-06', endMonth: '2025-06' },
      { ...gitLog[EN][0], location: '' },
    ])
      expect(GitCommitSchema.safeParse(invalid).success).toBe(false);
  });

  it('requires every career entry to link to its company over https', async () => {
    const { GitCommitSchema } = await import('./schemas');
    const { gitLog } = await import('./git-log');
    const { companyUrl: _omitted, ...withoutUrl } =
      gitLog[EN][0] ?? ({} as Record<string, unknown>);
    for (const invalid of [
      withoutUrl,
      { ...gitLog[EN][0], companyUrl: '' },
      { ...gitLog[EN][0], companyUrl: 'raylu.ai' },
      { ...gitLog[EN][0], companyUrl: 'http://raylu.ai' },
      { ...gitLog[EN][0], companyUrl: 'javascript:alert(1)' },
      { ...gitLog[EN][0], companyUrl: 'mailto:hello@raylu.ai' },
    ]) {
      expect(
        GitCommitSchema.safeParse(invalid).success,
        'a career entry without an https company URL renders an unlinked employer, or a link a visitor cannot trust',
      ).toBe(false);
    }
    for (const entry of gitLog[EN]) {
      expect(GitCommitSchema.safeParse(entry).success).toBe(true);
      expect(new URL(entry.companyUrl).protocol).toBe('https:');
    }
  });

  it('rejects a non-https company URL at every schema that carries one', async () => {
    const schemas = await import('./schemas');
    const { profile } = await import('./profile');
    const { aboutContent } = await import('./about');
    const { cvDocument, summaryDocument, cvJsonLd } = await import('./reading-views');
    type Check = { safeParse: (value: unknown) => { success: boolean } };
    const unsafe = ['javascript:alert(1)', 'http://raylu.ai', 'raylu.ai', ''];
    const cases: [string, Check, unknown, (url: string) => unknown][] = [
      [
        'ProfileSchema.currentEmployer.url',
        schemas.ProfileSchema,
        profile,
        (url) => ({ ...profile, currentEmployer: { ...profile.currentEmployer, url } }),
      ],
      [
        'CvDocumentSchema.experience[].companyUrl',
        schemas.CvDocumentSchema,
        cvDocument[EN],
        (url) => ({
          ...cvDocument[EN],
          experience: [{ ...cvDocument[EN].experience[0], companyUrl: url }],
        }),
      ],
      [
        'SummaryDocumentSchema.employer.url',
        schemas.SummaryDocumentSchema,
        summaryDocument[EN],
        (url) => ({ ...summaryDocument[EN], employer: { ...summaryDocument[EN].employer, url } }),
      ],
      [
        'AboutContentSchema.now.rows[].company.url',
        schemas.AboutContentSchema,
        aboutContent[EN],
        (url) => ({
          ...aboutContent[EN],
          now: {
            ...aboutContent[EN].now,
            rows: aboutContent[EN].now.rows.map((row) =>
              row.company ? { ...row, company: { ...row.company, url } } : row,
            ),
          },
        }),
      ],
      [
        'CvJsonLdSchema.mainEntity.worksFor.url',
        schemas.CvJsonLdSchema,
        cvJsonLd,
        (url) => ({
          ...cvJsonLd,
          mainEntity: {
            ...cvJsonLd.mainEntity,
            worksFor: { ...cvJsonLd.mainEntity.worksFor, url },
          },
        }),
      ],
    ];
    for (const [name, schema, shipped, mutate] of cases) {
      expect(schema.safeParse(shipped).success, `${name}: shipped content must validate`).toBe(
        true,
      );
      for (const url of unsafe) {
        expect(
          schema.safeParse(mutate(url)).success,
          `${name} must reject "${url}": it renders as a link href`,
        ).toBe(false);
      }
    }
  });

  it('gives each employer its own company URL', async () => {
    const { gitLog } = await import('./git-log');
    const origins = gitLog[EN].map((entry) => new URL(entry.companyUrl).origin);
    expect(new Set(origins).size).toBe(origins.length);
  });
});

describe('FooterContentSchema and shutdown content', () => {
  it('validates the shipped footer and every decorative shutdown line', async () => {
    const { FooterContentSchema, DmesgLineSchema } = await import('./schemas');
    const { footerContent } = await import('./footer');
    const { dmesgLines } = await import('./dmesg');
    expect(FooterContentSchema.safeParse(footerContent[EN]).success).toBe(true);
    for (const line of dmesgLines) expect(DmesgLineSchema.safeParse(line).success).toBe(true);
  });

  it('rejects missing groups, empty labels, unsafe links and unknown connection states', async () => {
    const { FooterContentSchema } = await import('./schemas');
    const { footerContent } = await import('./footer');
    const invalid = [
      { ...footerContent[EN], groups: [] },
      { ...footerContent[EN], sessionTitle: '' },
      { ...footerContent[EN], externalGlyph: '' },
      { ...footerContent[EN], haltedAt: '' },
      {
        ...footerContent[EN],
        connections: [{ ...footerContent[EN].connections[0], state: 'FAKE' }],
      },
      {
        ...footerContent[EN],
        groups: footerContent[EN].groups.map((group, index) =>
          index === 0
            ? { ...group, links: [{ label: 'unsafe', href: 'javascript:alert(1)' }] }
            : group,
        ),
      },
    ];
    for (const value of invalid) expect(FooterContentSchema.safeParse(value).success).toBe(false);
  });
});

describe('HeroContentSchema and hero content', () => {
  it('validates the shipped hero copy', async () => {
    const { HeroContentSchema, HeroClientContentSchema } = await import('./schemas');
    const { heroContent } = await import('./hero');
    const { heroClientContent } = await import('./hero-client');
    expect(HeroContentSchema.safeParse(heroContent[EN]).success).toBe(true);
    expect(HeroClientContentSchema.safeParse(heroClientContent[EN]).success).toBe(true);
  });

  it.each(['locationLabel', 'employerLabel', 'languageLabel', 'statsLabel'])(
    'rejects an empty hero %s',
    async (field) => {
      const { HeroContentSchema } = await import('./schemas');
      const { heroContent } = await import('./hero');
      expect(HeroContentSchema.safeParse({ ...heroContent[EN], [field]: '' }).success).toBe(false);
    },
  );

  it.each([
    'systemFailurePlate',
    'bootStaticDialogLine',
    'bootSequenceLine',
    'bootPrompt',
    'bootCommand',
    'bootWelcome',
  ])('rejects an empty hero-client %s', async (field) => {
    const { HeroClientContentSchema } = await import('./schemas');
    const { heroClientContent } = await import('./hero-client');
    expect(
      HeroClientContentSchema.safeParse({ ...heroClientContent[EN], [field]: '' }).success,
    ).toBe(false);
  });
});
