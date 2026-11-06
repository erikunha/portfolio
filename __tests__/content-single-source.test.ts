import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { companyLinkCopy } from '@/content/company-link';
import { errorsContent } from '@/content/errors';
import { errorsClientContent } from '@/content/errors-client';
import { footerContent } from '@/content/footer';
import { gitLog } from '@/content/git-log';
import { LINKS_PATH } from '@/content/links.constants';
import { measured } from '@/content/measured';
import { HIRE_ACCESSIBLE_NAME, TOPBAR_NAV } from '@/content/nav';
import { NAVIGATION } from '@/content/navigation';
import {
  profile,
  profileLanguageLine,
  profileLocation,
  profileMetaDescription,
  profilePageTitle,
  profilePresentation,
  profileSummary,
  profileWorkingLanguageLine,
  YEARS_OF_EXPERIENCE,
} from '@/content/profile';
import { projectPresentation } from '@/content/projects';
import { SECTION_REGISTRY } from '@/content/section-registry';
import { personSchema } from '@/content/seo';
import SHELL_RESPONSES from '@/content/shell-commands';
import { shellUi } from '@/content/shell-ui';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { EMAIL_ADDRESS } from '@/content/social-urls';
import { SYSTEM_TEXT } from '@/lib/ask/system-prompt';
import { HIRING_PROFILE } from '@/lib/hiring-profile';

vi.mock('next/font/local', () => ({
  default: () => ({ variable: '--font-mock', className: 'mock' }),
}));

const LOCALES: readonly SiteLocale[] = [SITE_LOCALE.en, SITE_LOCALE.pt];
const REPO_ROOT = path.resolve(__dirname, '..');
const SECTION_FRAGMENT = /#(sec-[a-z-]+)/g;
const FUNDS_PHRASE = '50+ funds holding $500B+ in assets';

const collectHrefs = (value: unknown): string[] => {
  if (typeof value === 'string') return [];
  if (Array.isArray(value)) return value.flatMap(collectHrefs);
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      key === 'href' && typeof child === 'string' ? [child] : collectHrefs(child),
    );
  }
  return [];
};

describe('derived strings render exactly what they rendered before', () => {
  it('keeps the hiring profile years, stack and receipts', () => {
    expect(HIRING_PROFILE.yoe).toBe(8);
    expect(HIRING_PROFILE.stack_primary).toEqual([
      'React',
      'Next.js',
      'TypeScript',
      'Angular',
      'RxJS',
      'NgRx',
    ]);
    expect(HIRING_PROFILE.receipts).toEqual({
      tx_volume_per_year: '40M+',
      revenue_platform: '€1.197B group revenue (Betsson)',
      mau_peak: '8M+ (Grupo SBF)',
      a11y_score: '~100/100',
      perf_delta_js: '-33%',
      perf_delta_css: '-98%',
      tti_improvement: '-52%',
      page_load_reduction: '-32%',
      conversion_uplift: '+10% (20+ A/B experiments)',
      api_latency_reduction: '-97.5% (40s → <1s, Venturus)',
      labs_delivered: '2.1M+ cumulative (VMware Pathfinder)',
      banking_customers: '24.2M digital clients (Itaú via Zup)',
      copilot_subagents: '12-agent system (Betsson)',
    });
  });

  it('keeps the ask prompt identity, funds and education lines', () => {
    expect(SYSTEM_TEXT).toContain('- 8+ years in production systems');
    expect(SYSTEM_TEXT.split(FUNDS_PHRASE)).toHaveLength(4);
    expect(SYSTEM_TEXT).toContain('MBA in AI Engineering in progress (Infnet, expected Dec 2027)');
  });

  it('keeps the Person JSON-LD description, experience, email and phone', () => {
    expect(personSchema.description).toBe(
      'Senior Software Engineer · Full Stack. Brazil · UTC-3 · available now. Raylu: private-markets fintech · B2B SaaS. 8+ years across regulated industries. Track record: -97.5% API latency, -98% CSS bundle, -52% TTI.',
    );
    expect(personSchema.hasOccupation.experienceRequirements).toBe('8+ years');
    expect(personSchema.email).toBe('erikhenriquealvescunha@gmail.com');
    expect(personSchema.telephone).toBe('+5519997049125');
    expect(personSchema.nationality.name).toBe('Brazil');
  });

  it('keeps the English profile exports', () => {
    expect(profileSummary).toBe(
      'Senior Software Engineer · Full Stack. Brazil · UTC-3 · available now. Raylu: private-markets fintech · B2B SaaS.',
    );
    expect(profileLocation).toBe('Brazil · UTC-3 · available now');
    expect(profilePageTitle).toBe('Erik Cunha · Senior Software Engineer · Full Stack');
    expect(profileMetaDescription).toBe(
      'Senior Software Engineer · Full Stack. Brazil · UTC-3 · available now. React, Next.js, Angular, TypeScript, JavaScript, Node.js, Python, AWS.',
    );
    expect(profileLanguageLine).toBe('PT-BR native · EN C1 · ES B1 · FR A2');
    expect(profileWorkingLanguageLine).toBe('PT-BR native · EN C1');
    expect(profilePresentation[SITE_LOCALE.en].summary).toBe(profileSummary);
  });

  it('keeps the contact email wherever it is shown', () => {
    for (const locale of LOCALES) {
      expect(shellUi[locale].email).toBe('erikhenriquealvescunha@gmail.com');
      expect(shellUi[locale].emailHref).toBe('mailto:erikhenriquealvescunha@gmail.com');
    }
    const contact = SHELL_RESPONSES.find((response) => response.text.startsWith('mailto:'));
    expect(contact?.text).toBe('mailto: erikhenriquealvescunha@gmail.com');
  });

  it('keeps the career domain line per locale', () => {
    expect(gitLog[SITE_LOCALE.en][0]?.domain).toBe('private-markets fintech · B2B SaaS');
    expect(gitLog[SITE_LOCALE.pt][0]?.domain).toBe('fintech de mercados privados · B2B SaaS');
    expect(gitLog[SITE_LOCALE.en][0]?.body.join(' ')).toContain(FUNDS_PHRASE);
    expect(gitLog[SITE_LOCALE.pt][0]?.body.join(' ')).toContain(
      'mais de 50 fundos com US$ 500B+ em ativos',
    );
  });

  it('keeps the disclosure wording', () => {
    expect(companyLinkCopy[SITE_LOCALE.en].disclosure).toBe('(opens in a new tab)');
    expect(companyLinkCopy[SITE_LOCALE.pt].disclosure).toBe('(abre em uma nova guia)');
    expect(measured[SITE_LOCALE.en].externalDisclosure).toBe('(opens in a new tab)');
    expect(measured[SITE_LOCALE.pt].externalDisclosure).toBe('(abre em uma nova guia)');
    expect(projectPresentation[SITE_LOCALE.en].externalDisclosure).toBe('(opens in a new tab)');
    expect(projectPresentation[SITE_LOCALE.pt].externalDisclosure).toBe('(abre em uma nova guia)');
    expect(HIRE_ACCESSIBLE_NAME[SITE_LOCALE.en]).toBe('Hire on LinkedIn (opens in a new tab)');
    expect(HIRE_ACCESSIBLE_NAME[SITE_LOCALE.pt]).toBe(
      'Contrate no LinkedIn (abre em uma nova guia)',
    );
  });
});

describe('one source per fact', () => {
  it('derives the years of experience everywhere from one constant', () => {
    expect(HIRING_PROFILE.yoe).toBe(YEARS_OF_EXPERIENCE);
    expect(SYSTEM_TEXT).toContain(`${YEARS_OF_EXPERIENCE}+ years`);
    expect(personSchema.hasOccupation.experienceRequirements).toBe(`${YEARS_OF_EXPERIENCE}+ years`);
    expect(personSchema.description).toContain(`${YEARS_OF_EXPERIENCE}+ years`);
  });

  it('stamps last_updated with the build date, not a frozen one', () => {
    expect(HIRING_PROFILE.last_updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(HIRING_PROFILE.last_updated).not.toBe('2026-10-30');
    expect(Date.parse(HIRING_PROFILE.last_updated)).toBeLessThanOrEqual(Date.now());
  });

  it('retypes the contact email in no module but content/social-urls.ts', () => {
    const roots = ['content', 'lib', 'app/api'];
    const offenders: string[] = [];
    for (const root of roots) {
      const dir = path.join(REPO_ROOT, root);
      for (const entry of readdirSync(dir, { recursive: true }).map(String)) {
        if (!/\.(ts|tsx)$/.test(entry) || /\.(test|spec)\./.test(entry)) continue;
        const relative = path.posix.join(root, entry);
        if (relative === 'content/social-urls.ts') continue;
        // behavioral-test-allow: the property is that no module spells the address itself, and
        // a render only proves the modules it mounted. Only the source text shows a retype.
        if (readFileSync(path.join(dir, entry), 'utf-8').includes(EMAIL_ADDRESS)) {
          offenders.push(relative);
        }
      }
    }
    expect(
      offenders,
      'import EMAIL_ADDRESS from content/social-urls.ts instead of spelling the address, so a changed inbox is one edit',
    ).toEqual([]);
  });

  it('points the /links entries at the page written in the active locale', () => {
    for (const locale of LOCALES) {
      const siteLinks = NAVIGATION[locale].siteLinks.map((link) => link.href);
      const surfaces: Array<[string, readonly string[]]> = [
        ['topbar', TOPBAR_NAV[locale].map((link) => link.href)],
        ['drawer foot', siteLinks],
        [
          'footer pages',
          footerContent[locale].groups.flatMap((group) => group.links.map((link) => link.href)),
        ],
        ['404 suggestions', errorsContent[locale].notFound.suggestions.map((link) => link.href)],
        ['error chrome', errorsClientContent[locale].chrome.nav.map((link) => link.href)],
      ];
      for (const [name, hrefs] of surfaces) {
        const linksHrefs = hrefs.filter((href) => href.startsWith('/links'));
        expect(linksHrefs, `${name} (${locale})`).toEqual([LINKS_PATH[locale]]);
      }
    }
  });

  it('points every section anchor at a section the registry renders', () => {
    const known = new Set<string>(SECTION_REGISTRY.map((section) => section.id));
    for (const locale of LOCALES) {
      const hrefs = [
        ...TOPBAR_NAV[locale].map((link) => link.href),
        ...collectHrefs(footerContent[locale]),
        ...collectHrefs(errorsContent[locale]),
        ...collectHrefs(errorsClientContent[locale]),
      ];
      const anchors = hrefs.flatMap((href) =>
        [...href.matchAll(SECTION_FRAGMENT)].map((m) => m[1]),
      );
      expect(anchors.length).toBeGreaterThan(0);
      for (const anchor of anchors)
        expect(known.has(anchor ?? ''), `${anchor} (${locale})`).toBe(true);
    }
  });

  it('prefixes the section anchors of the pt chrome with /pt and leaves the en ones bare', () => {
    expect(TOPBAR_NAV[SITE_LOCALE.en].map((link) => link.href).slice(0, 4)).toEqual([
      '/#sec-readme',
      '/#sec-projects',
      '/#sec-git-log',
      '/#sec-contact',
    ]);
    expect(TOPBAR_NAV[SITE_LOCALE.pt].map((link) => link.href).slice(0, 4)).toEqual([
      '/pt#sec-readme',
      '/pt#sec-projects',
      '/pt#sec-git-log',
      '/pt#sec-contact',
    ]);
  });

  it('labels the footer sections with the registry names', () => {
    for (const locale of LOCALES) {
      const labels = footerContent[locale].groups
        .flatMap((group) => group.links)
        .filter((link) => link.href.startsWith('#'))
        .map((link) => link.label);
      const registry = SECTION_REGISTRY.map((section) => section.label[locale]);
      expect(labels).toEqual(registry);
    }
  });

  it('shows the profile title once, from the presentation record', () => {
    expect(profilePresentation[SITE_LOCALE.en].title).toBe(profile.title);
  });
});
