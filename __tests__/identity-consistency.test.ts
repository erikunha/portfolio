import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ASK_EVAL_CORPUS } from '@/content/ask-eval-corpus';
import { communityEvent, communityTalksSentence } from '@/content/community';
import { contactLanguages } from '@/content/contact';
import { contactCopy } from '@/content/contact-copy';
import { education } from '@/content/education';
import { footerContent } from '@/content/footer';
import { gitLog } from '@/content/git-log';
import { heroTagline } from '@/content/hero';
import { perfReceipts } from '@/content/perf-receipts';
import {
  profile,
  profileLanguageLine,
  profilePresentation,
  profileWorkingLanguageLine,
} from '@/content/profile';
import { projects } from '@/content/projects';
import { cvDocument } from '@/content/reading-views';
import { PerfReceiptSchema, ProjectSchema } from '@/content/schemas';
import { personSchema } from '@/content/seo';
import { SITE_LOCALE } from '@/content/site-locale';
import { social } from '@/content/social';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';
import { HIRING_PROFILE } from '@/lib/hiring-profile';
import { readContentSurfaces } from './helpers/content-surfaces';

vi.mock('next/font/local', () => ({
  default: () => ({ variable: '--font-mock', className: 'mock' }),
}));

const CANONICAL_TITLE = 'Senior Software Engineer, AI Engineer';
const CANONICAL_TITLE_PT = 'Engenheiro de Software Sênior, Engenheiro de IA';
const RETIRED_TITLES = [
  'Senior Full-Stack Engineer',
  'Senior Software Engineer · Full Stack',
  'Engenheiro de Software Sênior · Full Stack',
  'Senior AI Engineer',
  'Engenheiro de IA Sênior',
];

const REPO_ROOT = path.resolve(__dirname, '..');

const read = (relativePath: string) => readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8');

const llmsTxt = read('public/llms.txt');
// behavioral-test-allow: the OG-image title is baked into an HTML template string inside the
// generator script, so it is reachable only as source text, there is nothing to import
const ogImageScript = readFileSync(path.join(REPO_ROOT, 'scripts/generate-og-image.ts'), 'utf-8');

const contentSurfaces: Array<[string, string]> = readContentSurfaces();

const digitsOf = (value: string) => value.replace(/\D/g, '');

let layoutMetadataText = '';

beforeAll(async () => {
  const { metadata } = await import('@/app/(en)/layout');
  layoutMetadataText = JSON.stringify(metadata);
});

describe('identity is consistent across every gated surface', () => {
  it('points every LinkedIn link at the canonical social.linkedin', () => {
    expect(contactCopy[SITE_LOCALE.en].queued.linkHref).toBe(social.linkedin);
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

  it('states the cross-platform code reuse the resume gives, on both surfaces', () => {
    const edtech = projects[SITE_LOCALE.en].find((project) => project.name === 'EDTECH_OMNI');
    expect(edtech).toBeDefined();
    expect(edtech?.stats?.find((stat) => stat.label === 'SHARED')?.value).toContain('80%');
    expect(JSON.stringify(gitLog[SITE_LOCALE.en])).toContain('80% shared code');
    expect(JSON.stringify(gitLog[SITE_LOCALE.en])).not.toContain('90%');
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
    for (const project of projects[SITE_LOCALE.en]) expect(SYSTEM_TEXT).toContain(project.company);
    expect(HIRING_PROFILE.education.map((entry) => entry.expected_completion)).toEqual(
      education[SITE_LOCALE.en].map((entry) => entry.expectedCompletion),
    );
  });

  it('points JSON-LD and llms.txt at the same community event and facts', () => {
    const talksSentence = communityTalksSentence;
    const capitalizedTalks = `${talksSentence.charAt(0).toUpperCase()}${talksSentence.slice(1)}`;
    expect(communityEvent[SITE_LOCALE.en].bullets).toContain(talksSentence);
    expect(personSchema.memberOf.url).toBe(communityEvent[SITE_LOCALE.en].link.href);
    expect(llmsTxt).toContain(communityEvent[SITE_LOCALE.en].link.href);
    expect(
      personSchema.memberOf.description,
      'the JSON-LD organization description must state the same talks sentence as content/community.ts, or a crawler reads a different conference than the page shows',
    ).toContain(talksSentence);
    expect(
      llmsTxt,
      'llms.txt must state the same talks sentence as content/community.ts, or an agent reads a different conference than the page shows',
    ).toContain(capitalizedTalks);
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
    expect(profileLanguageLine).toBe('PT-BR native · EN C1 · ES B1 · FR A2');
    expect(profileWorkingLanguageLine).toBe('PT-BR native · EN C1');
    expect(
      contactLanguages,
      'the contact section and the CV must render the same language line, or the two surfaces drift apart',
    ).toBe(cvDocument[SITE_LOCALE.en].languages);
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

  it('publishes every resume degree in llms.txt with the wording content/education.ts uses', () => {
    for (const entry of education[SITE_LOCALE.en]) {
      expect(
        llmsTxt,
        `public/llms.txt must state the degree as content/education.ts spells it ("${entry.degree}"), or an agent reads a different degree than the site renders.`,
      ).toContain(entry.degree);
      expect(
        llmsTxt,
        `public/llms.txt must name the institution of "${entry.degree}" ("${entry.institution}"), or an agent reads a different school than the site renders.`,
      ).toContain(entry.institution);
    }
  });

  it('lists every finished education institution, and only those, in the Person JSON-LD alumniOf', () => {
    const names = personSchema.alumniOf.map((entry) => entry.name);
    const finished = education[SITE_LOCALE.en].filter((entry) => !entry.expectedCompletion);
    for (const entry of finished) {
      expect(names.some((name) => name.includes(entry.institution))).toBe(true);
    }
    for (const name of names) {
      expect(finished.some((entry) => name.includes(entry.institution))).toBe(true);
    }
  });

  it('agent.json structured fields equal the hiring profile, not just mention it', () => {
    const manifest = JSON.parse(read('public/.well-known/agent.json')) as Record<string, unknown>;
    expect(manifest.title).toBe(HIRING_PROFILE.title);
    expect(manifest.title).toBe(CANONICAL_TITLE);
    expect(manifest.availability).toBe(HIRING_PROFILE.availability);
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
      ['content/hero.ts (heroTagline)', heroTagline(SITE_LOCALE.en)],
      ['content/seo.ts (jobTitle)', personSchema.jobTitle],
      ['app/(en)/layout.tsx (metadata.title)', String(JSON.parse(layoutMetadataText).title)],
      ['public/llms.txt', llmsTxt],
      ['lib/hiring-profile.ts', JSON.stringify(HIRING_PROFILE)],
      ['lib/ask/system-prompt.ts', SYSTEM_TEXT],
      ['public/.well-known/agent.json', read('public/.well-known/agent.json')],
      ['scripts/generate-og-image.ts (social preview card)', ogImageScript],
    ];
    const drifted = surfaces.filter(([, text]) => !text.includes(CANONICAL_TITLE)).map(([s]) => s);

    expect(
      drifted,
      `Every title surface must state "${CANONICAL_TITLE}". Update the listed content or generator sources.`,
    ).toEqual([]);
  });

  it('no surface still carries a retired title', () => {
    const surfaces: Array<[string, string]> = [
      ...contentSurfaces,
      ['app/(en)/layout.tsx (og + twitter + alt + description)', layoutMetadataText],
      ['lib/hiring-profile.ts (served at /api/erik.json)', JSON.stringify(HIRING_PROFILE)],
      ['lib/ask/system-prompt.ts', SYSTEM_TEXT],
      ['public/llms.txt', llmsTxt],
      ['public/.well-known/agent.json', read('public/.well-known/agent.json')],
      ['scripts/generate-og-image.ts (social preview card)', ogImageScript],
    ];
    const stale = surfaces
      .filter(([, text]) =>
        RETIRED_TITLES.some((title) => text.toLowerCase().includes(title.toLowerCase())),
      )
      .map(([s]) => s);

    expect(
      stale,
      `These surfaces still publish a retired title (${RETIRED_TITLES.join(' | ')}). Use "${CANONICAL_TITLE}" for current identity. Regenerate public/og.png and public/erik-cunha-cv.pdf separately; their rendered text is not checked here.`,
    ).toEqual([]);
  });

  it('states the Portuguese canonical title wherever the profile is localized', () => {
    expect(profilePresentation[SITE_LOCALE.pt].title).toBe(CANONICAL_TITLE_PT);
    expect(profilePresentation[SITE_LOCALE.en].title).toBe(CANONICAL_TITLE);
    expect(cvDocument[SITE_LOCALE.pt].role).toBe(CANONICAL_TITLE_PT);
    expect(heroTagline(SITE_LOCALE.pt)).toContain(CANONICAL_TITLE_PT);
  });

  it('names no intermediary for the current role, which the resume gives as a direct role', () => {
    const surfaces: Array<[string, string]> = [
      ...contentSurfaces,
      ['lib/hiring-profile.ts', JSON.stringify(HIRING_PROFILE)],
      ['lib/ask/system-prompt.ts', SYSTEM_TEXT],
      ['public/llms.txt', llmsTxt],
      ['content/ask-eval-corpus.ts', JSON.stringify(ASK_EVAL_CORPUS)],
    ];
    const stale = surfaces.filter(([, text]) => /\bTorc\b/.test(text)).map(([s]) => s);
    expect(
      stale,
      'the resume lists Raylu as a Senior Software Engineer role with no contract intermediary',
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
  it('targets Senior only, never Staff or Principal', () => {
    const surfaces: Array<[string, string]> = [
      ...contentSurfaces,
      ['lib/hiring-profile.ts', JSON.stringify(HIRING_PROFILE)],
      ['lib/ask/system-prompt.ts', SYSTEM_TEXT],
      ['public/llms.txt', llmsTxt],
      ['public/.well-known/agent.json', read('public/.well-known/agent.json')],
      ['app/(en)/layout.tsx (metadata)', layoutMetadataText],
    ];
    const stale = surfaces
      .filter(([, text]) => /\bStaff\b|\bPrincipal\b/.test(text))
      .map(([surface]) => surface);

    expect(
      stale,
      'the owner decision targets Senior only. A surface still naming Staff or Principal advertises a level the resume never claims.',
    ).toEqual([]);
    expect(HIRING_PROFILE.seniority).toEqual(['senior']);
    expect(HIRING_PROFILE.open_to).not.toContain('staff');
    expect(HIRING_PROFILE.open_to).not.toContain('principal');
  });

  it('describes Raylu as the resume does: an AI deal origination platform for private markets', () => {
    const surfaces: Array<[string, string]> = [
      ['lib/ask/system-prompt.ts', SYSTEM_TEXT],
      ['public/llms.txt', llmsTxt],
      ['content/ask-eval-corpus.ts', JSON.stringify(ASK_EVAL_CORPUS)],
    ];
    const missing = surfaces
      .filter(([, text]) => !/deal[- ]origination/i.test(text))
      .map(([surface]) => surface);

    expect(
      missing,
      'the resume describes Raylu as an AI deal origination platform for private markets used by funds holding $500B+ in assets. A surface that omits the framing describes a different company.',
    ).toEqual([]);
    expect(SYSTEM_TEXT).toContain('$500B+');
  });

  it('states the resume numbers on llms.txt, not the ones the resume replaced', () => {
    for (const stale of ['€1B+ ARR', '70M+', '10+ talks', 'WCAG 2.1', 'KPMG', '2,200+ clients']) {
      expect(llmsTxt, `public/llms.txt still publishes "${stale}"`).not.toContain(stale);
    }
    for (const current of [
      '€1.197B',
      '24.2M digital clients',
      '8 talks',
      'WCAG 2.2 AA',
      'Forward Deployed Engineer',
      'Zup Innovation',
    ]) {
      expect(llmsTxt, `public/llms.txt must publish "${current}"`).toContain(current);
    }
  });

  it('publishes the resume location and immediate availability consistently', () => {
    for (const text of [
      JSON.stringify(HIRING_PROFILE),
      SYSTEM_TEXT,
      llmsTxt,
      read('public/.well-known/agent.json'),
      JSON.stringify(personSchema),
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

  it('keeps eight employers with exact titles, month ranges and locations, and no education', () => {
    expect(
      gitLog[SITE_LOCALE.en].map((entry) => [
        entry.company,
        entry.role,
        entry.startMonth,
        entry.endMonth,
        entry.location,
        entry.workMode,
      ]),
    ).toEqual([
      ['Raylu', 'Senior Software Engineer', '2026-06', null, 'New York, US', 'remote'],
      ['Betsson Group', 'Senior Software Engineer', '2025-03', '2026-05', 'Malta', 'hybrid'],
      [
        'Forward Deployed Engineer',
        'Senior Software Engineer',
        '2023-03',
        '2025-03',
        'Remote',
        null,
      ],
      [
        'Grupo SBF (Nike / Centauro)',
        'Software Engineer',
        '2021-12',
        '2023-03',
        'São Paulo, Brazil',
        'remote',
      ],
      [
        'Encora (formerly Daitan)',
        'Software Engineer',
        '2021-01',
        '2021-12',
        'Campinas, Brazil',
        null,
      ],
      [
        'Zup Innovation (Itaú Unibanco)',
        'Software Engineer',
        '2020-04',
        '2021-01',
        'Campinas, Brazil',
        null,
      ],
      ['Venturus', 'Full Stack Engineer', '2019-02', '2020-04', 'Campinas, Brazil', null],
      ['MB Labs', 'Full Stack Engineer', '2018-07', '2019-02', 'Campinas, Brazil', null],
    ]);
    expect(gitLog[SITE_LOCALE.en].every((entry) => entry.type === 'career')).toBe(true);
    expect(
      gitLog[SITE_LOCALE.en].filter((entry) => entry.isRoot).map((entry) => entry.company),
    ).toEqual(['MB Labs']);
    expect(HIRING_PROFILE.employers.map((entry) => entry.role)).toEqual(
      gitLog[SITE_LOCALE.en].map((entry) => entry.role),
    );
    for (const entry of gitLog[SITE_LOCALE.en]) {
      expect(SYSTEM_TEXT).toContain(entry.role);
      expect(SYSTEM_TEXT).toContain(entry.date);
      expect(llmsTxt).toContain(entry.role);
      expect(llmsTxt).toContain(entry.date);
    }
  });

  it('publishes the service project and the resume-backed Raylu stack on desktop and mobile', () => {
    expect(projects[SITE_LOCALE.en].every((project) => project.company.length > 0)).toBe(true);
    const raylu = projects[SITE_LOCALE.en].find((project) => project.company === 'Raylu');
    expect(JSON.stringify(raylu)).toContain('NEXT 14');
    expect(JSON.stringify(raylu)).toContain('TS 5');
    expect(JSON.stringify(raylu)).not.toMatch(/Next(?:\.js)? 15|React 19/i);
    const service = projects[SITE_LOCALE.en].find(
      (project) => project.name === 'SERVICE_OPS_CONSOLE',
    );
    expect(service?.company).toBe('Forward Deployed Engineer');
    expect(service?.description).toContain('service orders');
    expect(service?.description).toContain('specialist scheduling');
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
    const service = projects[SITE_LOCALE.en].find(
      (project) => project.name === 'SERVICE_OPS_CONSOLE',
    );
    expect(service).toBeDefined();
    const parsed = ProjectSchema.parse({ ...service, mobileName: 'service_ops/' });
    expect(parsed).toEqual(service);
    expect(parsed.name).toBe('SERVICE_OPS_CONSOLE');
    expect(parsed).not.toHaveProperty('mobileName');
  });

  it('preserves receipt data while discarding retired mobile presentation fields', () => {
    const onboarding = perfReceipts[SITE_LOCALE.en].find((receipt) => receipt.metric === 'LCP');
    expect(onboarding).toBeDefined();
    const parsed = PerfReceiptSchema.parse({
      ...onboarding,
      mobileMetric: 'LARGEST_PAINT',
      desktopOnly: true,
    });
    expect(parsed).toEqual(onboarding);
    expect(parsed).not.toHaveProperty('mobileMetric');
    expect(parsed).not.toHaveProperty('desktopOnly');
  });
});
