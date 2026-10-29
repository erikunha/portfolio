import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { aboutContent } from '@/content/about';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';
import { communityEvent } from '@/content/community';
import { contactCopy } from '@/content/contact-copy';
import { education } from '@/content/education';
import { footerContent } from '@/content/footer';
import { gitLog } from '@/content/git-log';
import { heroTagline } from '@/content/hero';
import { perfReceipts } from '@/content/perf-receipts';
import { profile, profileLanguageLine, profileWorkingLanguageLine } from '@/content/profile';
import { projects } from '@/content/projects';
import { readmeCopy } from '@/content/readme';
import { PerfReceiptSchema, ProjectSchema } from '@/content/schemas';
import { personSchema } from '@/content/seo';
import { social } from '@/content/social';
import { visaRows } from '@/content/visa';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';
import { HIRING_PROFILE } from '@/lib/hiring-profile';
import { readContentSurfaces } from './helpers/content-surfaces';

vi.mock('next/font/local', () => ({
  default: () => ({ variable: '--font-mock', className: 'mock' }),
}));

const CANONICAL_TITLE = 'Senior Software Engineer, Frontend & Product';
const RETIRED_TITLE = 'Senior Full-Stack Engineer';

const REPO_ROOT = path.resolve(__dirname, '..');

const read = (relativePath: string) => readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8');

const llmsTxt = read('public/llms.txt');
// behavioral-test-allow: the OG-image title is baked into an HTML template string inside the
// generator script, so it is reachable only as source text — there is nothing to import
const ogImageScript = readFileSync(path.join(REPO_ROOT, 'scripts/generate-og-image.ts'), 'utf-8');

const contentSurfaces: Array<[string, string]> = readContentSurfaces();

const digitsOf = (value: string) => value.replace(/\D/g, '');

let layoutMetadataText = '';

beforeAll(async () => {
  const { metadata } = await import('@/app/layout');
  layoutMetadataText = JSON.stringify(metadata);
});

describe('identity is consistent across every gated surface', () => {
  it('points every LinkedIn link at the canonical social.linkedin', () => {
    expect(contactCopy.queued.linkHref).toBe(social.linkedin);
    const linkedinRows = JSON.stringify(footerContent).match(/https?:[^"]*linkedin[^"]*/g) ?? [];
    expect(linkedinRows.length).toBeGreaterThan(0);
    for (const href of linkedinRows) expect(href).toBe(social.linkedin);
  });

  it('derives JSON-LD sameAs, llms.txt links and profile actions from social', () => {
    expect(personSchema.sameAs).toEqual([social.linkedin, social.github]);
    expect(llmsTxt).toContain(`(${social.linkedin})`);
    expect(llmsTxt).toContain(`(${social.github})`);
    expect(profile.actions[0]?.href).toBe(social.github);
  });

  it('writes work authorization as prose in search descriptions, never as raw status tokens', () => {
    const descriptions = [
      personSchema.description,
      personSchema.seeks.itemOffered.description,
      readmeCopy.desktopIntro,
    ];
    for (const text of descriptions) {
      expect(text).toContain('Brazil: citizen');
    }
    const rawStatusToken = /CITIZEN|NEEDS_SPONSORSHIP|OPEN_WITH_SPONSORSHIP/;
    const rendered = [
      ...descriptions,
      aboutContent.whoami.intro,
      aboutContent.whoami.statusSuffix,
      JSON.stringify(aboutContent.now.rows),
    ];
    for (const text of rendered) expect(text).not.toMatch(rawStatusToken);
  });

  it('states the cross-platform code reuse the resume gives, on both surfaces', () => {
    const edtech = projects.find((project) => project.name === 'EDTECH_OMNI');
    expect(edtech).toBeDefined();
    expect(edtech?.stats?.find((stat) => stat.label === 'REUSE')?.value).toContain('80%');
    expect(JSON.stringify(gitLog)).toContain('80% shared code');
    expect(JSON.stringify(gitLog)).not.toContain('90%');
  });

  it('hands the ask prompt and the hiring profile the canonical contact links', () => {
    for (const link of [social.github, social.linkedin, social.email, social.site]) {
      expect(SYSTEM_TEXT).toContain(link);
    }
    expect(HIRING_PROFILE).toMatchObject({
      url: social.site,
      email: social.email,
      github: social.github,
      linkedin: social.linkedin,
    });
  });

  it('feeds every project company and expected completion to a consumer', () => {
    for (const project of projects) expect(SYSTEM_TEXT).toContain(project.company);
    expect(HIRING_PROFILE.education.map((entry) => entry.expected_completion)).toEqual(
      education.map((entry) => entry.expectedCompletion),
    );
  });

  it('points JSON-LD and llms.txt at the same community event and facts', () => {
    const [eventLink] = communityEvent.links;
    expect(personSchema.memberOf.url).toBe(eventLink?.href);
    expect(llmsTxt).toContain(eventLink?.href);
    expect(llmsTxt).toContain('8 talks');
    expect(llmsTxt).not.toContain('10+ talks');
    for (const language of profile.languages) expect(llmsTxt).toContain(language.name);
  });

  it('carries every resume language, and the hero shows only the working ones', () => {
    expect(profile.languages.map((language) => `${language.code}:${language.level}`)).toEqual([
      'pt:native',
      'en:C1',
      'es:B1',
      'fr:A2',
    ]);
    expect(profileLanguageLine).toBe('PT native · EN C1 · ES B1 · FR A2');
    expect(profileWorkingLanguageLine).toBe('PT native · EN C1');
  });

  it('expects the eval to answer with exactly the profile languages', () => {
    const item = ASK_EVAL_CORPUS.find((entry) => entry.id === 'fact-languages-spoken');
    expect(profile.languages.length).toBeGreaterThan(0);
    for (const language of profile.languages) expect(item?.expect).toContain(language.name);
    const others = ['Spanish', 'French', 'German', 'Italian', 'Japanese', 'Mandarin'].filter(
      (name) => !profile.languages.some((language) => language.name === name),
    );
    for (const name of others) expect(item?.expect).not.toContain(name);
  });

  it('lists every education institution in the Person JSON-LD alumniOf', () => {
    const names = personSchema.alumniOf.map((entry) => entry.name);
    for (const entry of education) {
      expect(names.some((name) => name.includes(entry.institution))).toBe(true);
    }
    for (const name of names) {
      expect(education.some((entry) => name.includes(entry.institution))).toBe(true);
    }
  });

  it('agent.json structured fields equal the hiring profile, not just mention it', () => {
    const manifest = JSON.parse(read('public/.well-known/agent.json')) as Record<string, unknown>;
    expect(manifest.title).toBe(HIRING_PROFILE.title);
    expect(manifest.title).toBe(CANONICAL_TITLE);
    expect(manifest.availability).toBe(HIRING_PROFILE.availability);
    expect(manifest.work_auth).toEqual(HIRING_PROFILE.work_auth);
  });

  it('keeps the zod-free shell copy equal to the canonical profile', async () => {
    const { NOW_CURRENTLY, WHOIS_TITLE } = await import('@/content/now-currently');
    const { profileSummary } = await import('@/content/profile');
    expect(NOW_CURRENTLY).toBe(profileSummary);
    expect(WHOIS_TITLE).toBe(profile.title);
  });

  it('serves every profile language with its name, not stripped by the hiring schema', () => {
    expect(HIRING_PROFILE.languages).toEqual(profile.languages);
  });

  it('every title surface states the canonical title', () => {
    const surfaces: Array<[string, string]> = [
      ['content/hero.ts (heroTagline)', heroTagline],
      ['content/seo.ts (jobTitle)', personSchema.jobTitle],
      ['app/layout.tsx (metadata.title)', String(JSON.parse(layoutMetadataText).title)],
      ['public/llms.txt', llmsTxt],
      ['lib/hiring-profile.ts', JSON.stringify(HIRING_PROFILE)],
      ['lib/ask/system-prompt.ts', SYSTEM_TEXT],
      ['public/.well-known/agent.json', read('public/.well-known/agent.json')],
      ['content/readme.ts', JSON.stringify(readmeCopy)],
      ['scripts/generate-og-image.ts (social preview card)', ogImageScript],
    ];
    const drifted = surfaces.filter(([, text]) => !text.includes(CANONICAL_TITLE)).map(([s]) => s);

    expect(
      drifted,
      `Every title surface must state "${CANONICAL_TITLE}". Update the listed content or generator sources.`,
    ).toEqual([]);
  });

  it('no surface still carries the retired title', () => {
    const surfaces: Array<[string, string]> = [
      ...contentSurfaces,
      ['app/layout.tsx (og + twitter + alt + description)', layoutMetadataText],
      ['lib/hiring-profile.ts (served at /api/erik.json)', JSON.stringify(HIRING_PROFILE)],
      ['lib/ask/system-prompt.ts', SYSTEM_TEXT],
      ['public/llms.txt', llmsTxt],
      ['public/.well-known/agent.json', read('public/.well-known/agent.json')],
      ['scripts/generate-og-image.ts (social preview card)', ogImageScript],
    ];
    const needle = RETIRED_TITLE.toLowerCase();
    const stale = surfaces
      .filter(([, text]) => text.toLowerCase().includes(needle))
      .map(([s]) => s);

    expect(
      stale,
      `These surfaces still publish "${RETIRED_TITLE}". Use "${CANONICAL_TITLE}" for current identity. Regenerate public/og.png and public/erik-cunha-cv.pdf separately; their rendered text is not checked here.`,
    ).toEqual([]);
  });

  it('the phone number is identical across the JSON-LD, the wa.me link, and llms.txt', () => {
    const canonical = digitsOf(personSchema.telephone);

    expect(
      digitsOf(social.whatsapp.split('/').pop() ?? ''),
      'the wa.me deep link must carry the same digits as the JSON-LD telephone. A wa.me link with the wrong digits silently resolves to nothing, or to a stranger.',
    ).toBe(canonical);

    expect(
      llmsTxt.includes(personSchema.telephone),
      `public/llms.txt must publish the same number as the JSON-LD (${personSchema.telephone}). This is the surface built for crawlers and LLMs; a wrong number here is machine-readable and gets dialled.`,
    ).toBe(true);
  });
});

describe('terminal redesign canonical facts', () => {
  it('serves the same four authorization statuses without abbreviating mobile statuses', () => {
    const expected = {
      Brazil: 'CITIZEN',
      EU_Malta: 'NEEDS_SPONSORSHIP',
      Canada: 'NEEDS_SPONSORSHIP',
      worldwide: 'OPEN_WITH_SPONSORSHIP',
    };
    expect(HIRING_PROFILE.work_auth).toEqual(expected);
    const manifest = JSON.parse(read('public/.well-known/agent.json'));
    expect(manifest.work_auth).toEqual(expected);
    expect(visaRows.map((row) => [row.jurisdiction, row.status])).toEqual([
      ['Brazil', 'CITIZEN'],
      ['EU (Malta)', 'NEEDS_SPONSORSHIP'],
      ['Canada', 'NEEDS_SPONSORSHIP'],
      ['Worldwide', 'OPEN_WITH_SPONSORSHIP'],
    ]);
    for (const row of visaRows) {
      expect(row.statusShort).toBe(row.status);
      expect(SYSTEM_TEXT).toContain(`${row.jurisdiction}: ${row.status}`);
      expect(llmsTxt).toContain(`${row.jurisdiction}: ${row.status}`);
      expect(JSON.parse(layoutMetadataText).other['work-authorization']).toContain(
        `${row.jurisdiction}: ${row.status}`,
      );
    }
    expect(visaRows[2]?.evidence).toBe(
      'lived and worked in Vancouver, 2023-2025 · co-op diploma, CICCC',
    );
  });

  it('publishes the resume location and immediate availability consistently', () => {
    for (const text of [
      JSON.stringify(HIRING_PROFILE),
      SYSTEM_TEXT,
      llmsTxt,
      read('public/.well-known/agent.json'),
      JSON.stringify(personSchema),
      JSON.stringify(readmeCopy),
      layoutMetadataText,
    ]) {
      expect(text).toContain('Brazil');
      expect(text).toContain('UTC-3');
      expect(text).toContain('available now');
      expect(text).not.toContain('Campinas, São Paulo, Brazil');
    }
    expect(personSchema.address.addressLocality).toBe('Paulínia');
  });

  it('uses the canonical title in page and social metadata', () => {
    const metadata = JSON.parse(layoutMetadataText);
    for (const text of [
      metadata.title,
      metadata.description,
      metadata.openGraph.title,
      metadata.openGraph.description,
      metadata.openGraph.images[0].alt,
      metadata.twitter.title,
      metadata.twitter.description,
    ]) {
      expect(text).toContain(CANONICAL_TITLE);
    }
  });

  it('keeps nine employers with exact titles, month ranges and locations, and no education', () => {
    expect(
      gitLog.map((entry) => [
        entry.company,
        entry.role,
        entry.startMonth,
        entry.endMonth,
        entry.location,
        entry.workMode,
      ]),
    ).toEqual([
      [
        'Raylu',
        'Senior Software Engineer, Frontend & Product (contract via Torc)',
        '2026-06',
        null,
        'New York, US',
        'remote',
      ],
      [
        'Betsson Group',
        'Senior Software Engineer, Frontend',
        '2025-03',
        '2026-05',
        'Malta',
        'hybrid',
      ],
      [
        'Canon Medical Systems',
        'Senior Software Engineer, Frontend (independent consultant)',
        '2023-03',
        '2025-03',
        'Canada',
        'remote',
      ],
      [
        'Grupo SBF (Nike / Centauro)',
        'Software Engineer, Frontend',
        '2021-12',
        '2023-03',
        'São Paulo, Brazil',
        'remote',
      ],
      [
        'Encora (formerly Daitan)',
        'Software Engineer, Frontend · assigned to VMware',
        '2021-01',
        '2021-12',
        'Campinas, Brazil',
        null,
      ],
      [
        'ZUP Innovation (Itaú Unibanco)',
        'Software Engineer, Frontend',
        '2020-04',
        '2021-01',
        'Campinas, Brazil',
        null,
      ],
      [
        'Venturus',
        'Full-Stack Software Engineer → Software Engineer, Frontend',
        '2019-02',
        '2020-04',
        'Campinas, Brazil',
        null,
      ],
      [
        'MB Labs',
        'Full-Stack Software Engineer → Software Engineer, Cross-Platform',
        '2018-07',
        '2019-02',
        'Campinas, Brazil',
        null,
      ],
      [
        'Monde Sistemas',
        'Software Engineer Intern, Frontend',
        '2017-10',
        '2018-05',
        'Americana, Brazil',
        null,
      ],
    ]);
    expect(gitLog.every((entry) => entry.type === 'career')).toBe(true);
    expect(gitLog.filter((entry) => entry.isRoot).map((entry) => entry.company)).toEqual([
      'Monde Sistemas',
    ]);
    expect(HIRING_PROFILE.employers.map((entry) => entry.role)).toEqual(
      gitLog.map((entry) => entry.role),
    );
    for (const entry of gitLog) {
      expect(SYSTEM_TEXT).toContain(entry.role);
      expect(SYSTEM_TEXT).toContain(entry.date);
      expect(llmsTxt).toContain(entry.role);
      expect(llmsTxt).toContain(entry.date);
    }
  });

  it('publishes the service project and the resume-backed Raylu stack on desktop and mobile', () => {
    expect(projects.every((project) => project.company.length > 0)).toBe(true);
    const raylu = projects.find((project) => project.company === 'Raylu');
    expect(JSON.stringify(raylu)).toContain('Next.js 14');
    expect(JSON.stringify(raylu)).toContain('TypeScript 5');
    expect(JSON.stringify(raylu)).not.toMatch(/Next(?:\.js)? 15|React 19/i);
    const service = projects.find((project) => project.name === 'SERVICE_OPS_CONSOLE');
    expect(service?.company).toBe('Canon Medical Systems');
    expect(service?.description).toContain('service orders');
    expect(service?.description).toContain('specialist schedules');
    expect(service?.description).toContain('field visits');
    for (const text of [
      JSON.stringify(projects),
      SYSTEM_TEXT,
      llmsTxt,
      JSON.stringify(HIRING_PROFILE),
    ]) {
      expect(text).not.toContain('CARE_OPS_CONSOLE');
    }
  });

  it('keeps the canonical project name when parsing retired mobile overrides', () => {
    const service = projects.find((project) => project.name === 'SERVICE_OPS_CONSOLE');
    expect(service).toBeDefined();
    const parsed = ProjectSchema.parse({ ...service, mobileName: 'service_ops/' });
    expect(parsed).toEqual(service);
    expect(parsed.name).toBe('SERVICE_OPS_CONSOLE');
    expect(parsed).not.toHaveProperty('mobileName');
  });

  it('preserves receipt data while discarding retired mobile presentation fields', () => {
    const onboarding = perfReceipts.find((receipt) => receipt.metric === 'ONBOARDING_TIME');
    expect(onboarding).toBeDefined();
    const parsed = PerfReceiptSchema.parse({
      ...onboarding,
      mobileMetric: 'ONBOARDING',
      desktopOnly: true,
    });
    expect(parsed).toEqual(onboarding);
    expect(parsed).not.toHaveProperty('mobileMetric');
    expect(parsed).not.toHaveProperty('desktopOnly');
  });
});
