import { describe, expect, it } from 'vitest';

const guitarPresentationFixture = {
  signalStrengthLabelTemplate: '{n} of {total}',
  signalStrip: {
    live: '● SIGNAL_CHAIN.LIVE · SIGNAL OK',
    tail: 'TAIL -F ~/.RIG',
  },
  signalChain: [
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
  ],
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
    expect(GuitarPresentationSchema.parse(guitarPresentation)).toEqual(guitarPresentationFixture);
    expect(guitarRig.signalChain.map((node) => node.role)).toEqual(['INPUT', 'FX', 'AMP', 'OUT']);
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
        signalChain: indices.map((index) => guitarPresentationFixture.signalChain[index]),
      }).success,
    ).toBe(false);
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

  it('accepts new signalChain + influences + stats shape', async () => {
    const { GuitarRigSchema } = await import('./schemas');
    expect(() =>
      GuitarRigSchema.parse({
        signalChain: [
          { role: 'INPUT', name: 'TEST', subtitle: 'sub', strengthDots: 4 },
          { role: 'FX', name: 'FX', subtitle: 'sub' },
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

const validSixChannels = [
  baseChannel('CH 01'),
  baseChannel('CH 02'),
  baseChannel('CH 03'),
  baseChannel('CH 04'),
  baseChannel('CH 05'),
  { ...baseChannel('MASTER'), buttons: ['FX', 'EQ'] },
];

describe('DawMixerSchema', () => {
  it('accepts a valid 6-channel config with MASTER last', async () => {
    const { DawMixerSchema } = await import('./schemas');
    expect(() =>
      DawMixerSchema.parse({
        sessionName: 'TEST.ALS',
        bpm: 87,
        timeSignature: '4/4',
        status: 'MIXING',
        transportTime: '00:01:24:08',
        channels: validSixChannels,
      }),
    ).not.toThrow();
  });

  it('rejects fewer than 6 channels', async () => {
    const { DawMixerSchema } = await import('./schemas');
    expect(() =>
      DawMixerSchema.parse({
        sessionName: 'TEST.ALS',
        bpm: 87,
        timeSignature: '4/4',
        status: 'MIXING',
        transportTime: '00:01:24:08',
        channels: validSixChannels.slice(0, 5),
      }),
    ).toThrow();
  });

  it('rejects 6 channels when last is not MASTER', async () => {
    const { DawMixerSchema } = await import('./schemas');
    const noMaster = validSixChannels.map((c) => ({
      ...c,
      id: c.id === 'MASTER' ? 'CH 06' : c.id,
    }));
    expect(() =>
      DawMixerSchema.parse({
        sessionName: 'TEST.ALS',
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
  title: 'Senior Software Engineer, Frontend & Product',
  technologyLine: 'React · Next.js · TypeScript · Angular · Node.js · AWS',
  country: 'Brazil',
  city: 'Paulínia',
  timezone: 'UTC-3',
  availability: 'available now',
  currentEmployer: {
    name: 'Raylu',
    url: 'https://raylu.ai',
    context: 'private-markets fintech · B2B SaaS',
  },
  languages: [
    { code: 'pt', name: 'Portuguese', level: 'native' },
    { code: 'en', name: 'English', level: 'C1' },
    { code: 'es', name: 'Spanish', level: 'B1' },
    { code: 'fr', name: 'French', level: 'A2' },
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
    expect(profile).toEqual(profileFixture);
  });

  it('rejects missing identity, invalid actions and missing language levels', async () => {
    const { ProfileSchema } = await import('./schemas');
    for (const invalid of [
      { ...profileFixture, title: '' },
      { ...profileFixture, country: '' },
      { ...profileFixture, actions: [{ label: 'CV', href: 'javascript:alert(1)' }] },
      { ...profileFixture, languages: [{ code: 'en', name: 'English' }] },
    ])
      expect(ProfileSchema.safeParse(invalid).success).toBe(false);
  });

  it('validates and publishes three education fixtures separately from certifications', async () => {
    const { EducationSchema } = await import('./schemas');
    const { education } = await import('./education');
    expect(EducationSchema.array().parse(educationFixtures)).toEqual(educationFixtures);
    expect(education).toEqual(educationFixtures);
    const { credentials } = await import('./credentials');
    expect(credentials).toEqual([
      { label: 'ANGULAR_DEV', badge: 'CERTIFIED', evidence: 'certificates.dev · 2024' },
      { label: 'ENGLISH', badge: 'IELTS_GENERAL_TRAINING', evidence: 'C1 · 2023' },
      { label: 'INTL_DEGREE', badge: 'WES_VERIFIED', evidence: 'World Education Services · 2022' },
    ]);
    const { communityEvent } = await import('./community');
    expect(communityEvent.statusLine).toBe(
      'open to CFP submissions for 2027 · open to volunteer / organizer roles.',
    );
  });

  it('publishes one community event link and rejects one that is not an absolute URL', async () => {
    const { CommunityEventSchema } = await import('./schemas');
    const { communityEvent } = await import('./community');
    expect(CommunityEventSchema.parse(communityEvent)).toEqual(communityEvent);
    const invalid = { ...communityEvent, link: { ...communityEvent.link, href: 'devopsdays.org' } };
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
      { ...gitLog[0], startMonth: '2026-13' },
      { ...gitLog[0], startMonth: '2026-06', endMonth: '2025-06' },
      { ...gitLog[0], location: '' },
    ])
      expect(GitCommitSchema.safeParse(invalid).success).toBe(false);
  });

  it('requires every career entry to link to its company over https', async () => {
    const { GitCommitSchema } = await import('./schemas');
    const { gitLog } = await import('./git-log');
    const { companyUrl: _omitted, ...withoutUrl } = gitLog[0] ?? ({} as Record<string, unknown>);
    for (const invalid of [
      withoutUrl,
      { ...gitLog[0], companyUrl: '' },
      { ...gitLog[0], companyUrl: 'raylu.ai' },
      { ...gitLog[0], companyUrl: 'http://raylu.ai' },
      { ...gitLog[0], companyUrl: 'javascript:alert(1)' },
      { ...gitLog[0], companyUrl: 'mailto:hello@raylu.ai' },
    ]) {
      expect(
        GitCommitSchema.safeParse(invalid).success,
        'a career entry without an https company URL renders an unlinked employer, or a link a visitor cannot trust',
      ).toBe(false);
    }
    for (const entry of gitLog) {
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
        cvDocument,
        (url) => ({
          ...cvDocument,
          experience: [{ ...cvDocument.experience[0], companyUrl: url }],
        }),
      ],
      [
        'SummaryDocumentSchema.employer.url',
        schemas.SummaryDocumentSchema,
        summaryDocument,
        (url) => ({ ...summaryDocument, employer: { ...summaryDocument.employer, url } }),
      ],
      [
        'AboutContentSchema.now.rows[].company.url',
        schemas.AboutContentSchema,
        aboutContent,
        (url) => ({
          ...aboutContent,
          now: {
            ...aboutContent.now,
            rows: aboutContent.now.rows.map((row) =>
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
    const origins = gitLog.map((entry) => new URL(entry.companyUrl).origin);
    expect(new Set(origins).size).toBe(origins.length);
  });
});

describe('FooterContentSchema and shutdown content', () => {
  it('validates the shipped footer and every decorative shutdown line', async () => {
    const { FooterContentSchema, DmesgLineSchema } = await import('./schemas');
    const { footerContent } = await import('./footer');
    const { dmesgLines } = await import('./dmesg');
    expect(FooterContentSchema.safeParse(footerContent).success).toBe(true);
    for (const line of dmesgLines) expect(DmesgLineSchema.safeParse(line).success).toBe(true);
  });

  it('rejects missing groups, empty labels, unsafe links and unknown connection states', async () => {
    const { FooterContentSchema } = await import('./schemas');
    const { footerContent } = await import('./footer');
    const invalid = [
      { ...footerContent, groups: [] },
      { ...footerContent, sessionTitle: '' },
      { ...footerContent, externalGlyph: '' },
      { ...footerContent, haltedAt: '' },
      { ...footerContent, connections: [{ ...footerContent.connections[0], state: 'FAKE' }] },
      {
        ...footerContent,
        groups: footerContent.groups.map((group, index) =>
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
    expect(HeroContentSchema.safeParse(heroContent).success).toBe(true);
    expect(HeroClientContentSchema.safeParse(heroClientContent).success).toBe(true);
  });

  it.each(['locationLabel', 'employerLabel', 'languageLabel', 'statsLabel'])(
    'rejects an empty hero %s',
    async (field) => {
      const { HeroContentSchema } = await import('./schemas');
      const { heroContent } = await import('./hero');
      expect(HeroContentSchema.safeParse({ ...heroContent, [field]: '' }).success).toBe(false);
    },
  );

  it.each([
    'systemFailurePlate',
    'bootStaticDialogLine',
    'bootSequenceLine',
    'bootPrompt',
    'bootCommand',
  ])('rejects an empty hero-client %s', async (field) => {
    const { HeroClientContentSchema } = await import('./schemas');
    const { heroClientContent } = await import('./hero-client');
    expect(HeroClientContentSchema.safeParse({ ...heroClientContent, [field]: '' }).success).toBe(
      false,
    );
  });
});
