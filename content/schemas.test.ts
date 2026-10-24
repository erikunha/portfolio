import { describe, expect, it } from 'vitest';

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
          { role: 'FX', name: 'FX', subtitle: 'sub', blocks: [{ name: 'COMP', active: true }] },
          { role: 'AMP', name: 'AMP', subtitle: 'sub', strengthDots: 3 },
          { role: 'OUT', name: 'OUT', subtitle: 'sub', strengthDots: 5 },
        ],
        influences: [
          { rank: 1, name: 'A', strength: 5, active: true },
          { rank: 2, name: 'B', strength: 4 },
          { rank: 3, name: 'C', strength: 3 },
          { rank: 4, name: 'D', strength: 3 },
          { rank: 5, name: 'E', strength: 2 },
        ],
        nowObsessing: 'some song',
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
  currentEmployer: { name: 'Raylu', context: 'private-markets fintech · B2B SaaS' },
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
    degree: 'MBA, AI Engineering',
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
    institution: 'CICCC',
    location: 'Vancouver, Canada',
    studyMode: null,
    startYear: 2023,
    endYear: 2024,
    expectedCompletion: null,
    period: '2023-2024',
  },
  {
    id: 'BS_INFO_SYSTEMS',
    degree: 'BS, Information Systems',
    institution: 'UNISAL',
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
      { ...footerContent, copyLabel: '' },
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
