import { parse } from 'postcss';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readComponentsCss } from '@/__tests__/helpers/components-css';
import { declValue, rulesInMedia } from '@/__tests__/helpers/css-rules';
import CvPage, { metadata as cvMetadata } from '@/app/cv/page';
import SummaryPage, { metadata as summaryMetadata } from '@/app/summary/page';
import { EXTERNAL_LINK_PROPS } from '@/components/ExternalLink';
import { credentials } from '@/content/credentials';
import { education } from '@/content/education';
import { gitLog } from '@/content/git-log';
import { heroContent } from '@/content/hero';
import { profile } from '@/content/profile';
import {
  cvDocument,
  READING_PATHS,
  readingViews,
  summaryDocument,
  toSentence as toSentenceBase,
} from '@/content/reading-views';
import { SITE_LOCALE } from '@/content/site-locale';
import { social } from '@/content/social';

function render(page: () => React.ReactElement) {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(page());
  return host;
}

function page(host: HTMLElement): HTMLElement {
  const main = host.querySelector<HTMLElement>('main#main-content');
  if (!main) throw new Error('the reading view renders no main landmark');
  return main;
}

const toSentence = toSentenceBase(SITE_LOCALE.en);
const readingViewsEn = readingViews[SITE_LOCALE.en];
const cvDocumentEn = cvDocument[SITE_LOCALE.en];
const summaryDocumentEn = summaryDocument[SITE_LOCALE.en];
const heroContentEn = heroContent[SITE_LOCALE.en];
const gitLogEn = gitLog[SITE_LOCALE.en];

describe('toSentence', () => {
  it('capitalises a fragment and closes it with a period', () => {
    expect(toSentence('rebuilt the investor screens')).toBe('Rebuilt the investor screens.');
  });

  it('keeps existing terminal punctuation', () => {
    expect(toSentence('Already done.')).toBe('Already done.');
  });

  it('rewrites a known resume fragment into a full sentence', () => {
    expect(toSentence('Angular 17 to 19')).toBe('Upgraded the platform from Angular 17 to 19.');
  });
});

describe('CV reading view', () => {
  const host = render(CvPage);

  it('has one h1 with the name and the role under it', () => {
    expect(host.querySelectorAll('h1')).toHaveLength(1);
    expect(host.querySelector('h1')?.textContent).toBe(profile.displayName);
    expect(host.textContent).toContain(profile.title);
  });

  it('names every section with a heading that labels its section', () => {
    const headings = Object.values(readingViewsEn.cv.headings);
    for (const heading of headings) {
      const h2 = Array.from(host.querySelectorAll('h2')).find(
        (node) => node.textContent === heading,
      );
      expect(h2, heading).toBeDefined();
      expect(h2?.closest('section')?.getAttribute('aria-labelledby')).toBe(h2?.id);
    }
  });

  it('lists every job once, as full sentences with no leftover semicolons', () => {
    const experience = host.querySelectorAll('section[aria-labelledby="cv-experience"] article');
    expect(experience).toHaveLength(gitLogEn.length);
    for (const job of cvDocumentEn.experience) {
      expect(host.textContent).toContain(job.company);
      for (const bullet of job.bullets) {
        expect(bullet).toMatch(/^[A-Z0-9]/);
        expect(bullet).toMatch(/[.!?)]$/);
        expect(bullet).not.toContain(';');
      }
    }
  });

  it('links every employer heading to its company site', () => {
    const headings = host.querySelectorAll('section[aria-labelledby="cv-experience"] article h3');
    expect(headings).toHaveLength(gitLogEn.length);
    gitLogEn.forEach((job, index) => {
      const link = headings[index]?.querySelector('a');
      expect(link?.getAttribute('href'), job.company).toBe(job.companyUrl);
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toBe(EXTERNAL_LINK_PROPS.rel);
      expect(link?.textContent).toBe(job.company);
      const heading = headings[index];
      expect(
        heading?.querySelector('.sr-only, svg, [aria-hidden="true"]'),
        'a type-reveal heading holds only typed text: extra nodes inflate --type-chars past the visible name',
      ).toBeNull();
      const description = host.querySelector(`#${link?.getAttribute('aria-describedby')}`);
      expect(description?.textContent).toBe(readingViewsEn.shared.newTabHint);
      expect(description?.closest('[data-type-reveal]')).toBeNull();
    });
  });

  it('shows every certification and degree row', () => {
    for (const entry of credentials) expect(host.textContent).toContain(entry.evidence);
    for (const entry of education[SITE_LOCALE.en]) expect(host.textContent).toContain(entry.degree);
  });

  it('keeps the summary free of the header facts', () => {
    expect(cvDocumentEn.summary.length).toBeGreaterThan(40);
    expect(cvDocumentEn.summary).not.toContain(profile.title);
    expect(cvDocumentEn.summary).not.toContain(cvDocumentEn.location);
  });

  it('states the resume SUMMARY as the CV summary', () => {
    expect(cvDocumentEn.summary).toContain('micro-frontend topologies');
    expect(cvDocumentEn.summary).toContain('backend-for-frontend (BFF)');
    expect(cvDocumentEn.summary).not.toContain('8+ years building frontend systems');
  });

  it('states the resume location in the header and publishes no phone number', () => {
    const header = host.querySelector('.reading-meta');
    expect(header?.textContent).toBe('Paulínia, Brazil');
    expect(host.textContent).not.toMatch(/\+\d[\d\s()-]{6,}\d/);
  });

  it('lists the resume core expertise as the CV skills', () => {
    const skills = cvDocumentEn.skills.join(' · ');
    expect(skills).toContain('Frontend & Product Architecture');
    expect(skills).toContain('Testing, Quality & Release Engineering');
    expect(skills).toContain('BFF, APIs & Data');
    expect(skills).toContain('AI-Native Product & Agent Engineering');
    expect(skills).toContain('TanStack Table and Query');
    expect(skills).toContain('Fastify');
    expect(skills).not.toContain('User Journeys');
  });

  it('states every education degree and institution in full', () => {
    expect(host.textContent).toContain('B.S. Information Systems');
    expect(host.textContent).toContain('Centro Universitário Salesiano de São Paulo (UNISAL)');
    expect(host.textContent).toContain(
      'Cornerstone International Community College of Canada (CICCC)',
    );
    expect(host.textContent).toContain(
      'MBA (Lato Sensu), AI Engineering, Machine Learning and Deep Learning',
    );
  });

  it('opens external links in a new tab with a hint for screen readers', () => {
    const linkedin = page(host).querySelector(`a[href="${social.linkedin}"]`);
    expect(linkedin?.getAttribute('target')).toBe('_blank');
    expect(linkedin?.getAttribute('rel')).toBe(EXTERNAL_LINK_PROPS.rel);
    const external = Array.from(page(host).querySelectorAll('a[target="_blank"]'));
    expect(external.length).toBeGreaterThan(0);
    for (const link of external) {
      const named = link.getAttribute('aria-label') ?? link.textContent;
      const describedBy = link.getAttribute('aria-describedby');
      const description = describedBy ? host.querySelector(`#${describedBy}`)?.textContent : '';
      expect(`${named} ${description}`).toMatch(/new tab/);
    }
  });

  it('links to the email, the summary view and a print button', () => {
    expect(page(host).querySelector(`a[href="mailto:${social.email}"]`)).not.toBeNull();
    expect(page(host).querySelector(`a[href="${READING_PATHS.summary}"]`)).not.toBeNull();
    const print = Array.from(host.querySelectorAll('button')).find(
      (button) => button.textContent === readingViewsEn.shared.printLabel,
    );
    expect(print).toBeDefined();
  });

  it('marks the actions so print can hide them, and gives the shell skip link a target', () => {
    expect(host.querySelector('.reading-actions')).not.toBeNull();
    const skips = host.querySelectorAll('a.skip-to-content');
    expect(skips).toHaveLength(1);
    expect(skips[0]?.getAttribute('href')).toBe('#main-content');
    expect(host.querySelectorAll('main#main-content')).toHaveLength(1);
  });

  it('renders inside the shared shell and owns no header of its own', () => {
    expect(host.querySelector('.desktop-topbar')).not.toBeNull();
    expect(host.querySelector('.mobile-title-bar')).not.toBeNull();
    expect(host.querySelector('.reading-bar')).toBeNull();
    expect(host.querySelector('main#main-content')?.classList.contains('page-container')).toBe(
      true,
    );
  });

  it('describes itself as a profile page for search engines', () => {
    const script = host.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script?.textContent ?? '{}');
    expect(data['@type']).toBe('ProfilePage');
    expect(data.url).toBe(`${social.site}${READING_PATHS.cv}`);
  });

  it('declares its canonical URL and social card', () => {
    expect(cvMetadata.alternates?.canonical).toBe(`${social.site}${READING_PATHS.cv}`);
    expect(cvMetadata.title).toBe(readingViewsEn.cv.title);
    expect(cvMetadata.twitter).toMatchObject({ card: 'summary_large_image' });
  });
});

describe('summary reading view', () => {
  const host = render(SummaryPage);

  it('renders inside the shared shell with one skip link and one main landmark', () => {
    expect(host.querySelector('.desktop-topbar')).not.toBeNull();
    expect(host.querySelector('.mobile-title-bar')).not.toBeNull();
    expect(host.querySelector('.reading-bar')).toBeNull();
    expect(host.querySelectorAll('a.skip-to-content')).toHaveLength(1);
    expect(host.querySelectorAll('main#main-content')).toHaveLength(1);
    expect(host.querySelector('main#main-content')?.classList.contains('page-container')).toBe(
      true,
    );
  });

  it('keeps the print action in the call to action row', () => {
    const row = host.querySelector('.reading-actions');
    const print = Array.from(row?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent === readingViewsEn.shared.printLabel,
    );
    expect(print).toBeDefined();
  });

  it('has one h1 with the name', () => {
    expect(host.querySelectorAll('h1')).toHaveLength(1);
    expect(host.querySelector('h1')?.textContent).toBe(profile.displayName);
  });

  it('shows every hero number with their labels', () => {
    const tiles = host.querySelectorAll(
      `[aria-label="${readingViewsEn.summary.statsLabel}"] .stat-tile`,
    );
    expect(tiles).toHaveLength(heroContentEn.stats.length);
    heroContentEn.stats.forEach((stat, index) => {
      expect(tiles[index]?.textContent).toContain(stat.value);
      expect(tiles[index]?.textContent).toContain(stat.label);
    });
    expect(host.textContent).not.toContain('€1B+ ARR');
  });

  it('links the current employer in the context line to its company site', () => {
    const links = host.querySelectorAll('.reading-meta a');
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe(profile.currentEmployer.url);
    expect(links[0]?.getAttribute('target')).toBe('_blank');
    expect(links[0]?.getAttribute('rel')).toBe(EXTERNAL_LINK_PROPS.rel);
    expect(links[0]?.textContent).toContain(profile.currentEmployer.name);
    expect(links[0]?.textContent).toContain(readingViewsEn.shared.newTabHint);
  });

  it('publishes no relocation or work-authorization chip', () => {
    expect(host.textContent).not.toContain('OPEN_TO_RELOCATION');
    expect(host.textContent).not.toContain('OPEN_WITH_SPONSORSHIP');
  });

  it('shows the chosen projects with a headline stat each', () => {
    const entries = host.querySelectorAll('.reading-projects > li');
    expect(entries).toHaveLength(readingViewsEn.summary.projectNames.length);
    const names = Array.from(entries, (entry) => entry.querySelector('h3')?.textContent);
    expect(names).toEqual(summaryDocumentEn.projects.map((project) => project.name));
    for (const project of summaryDocumentEn.projects) {
      expect(host.textContent).toContain(project.name);
      expect(host.textContent).toContain(project.value);
    }
  });

  it('shows the stack chips and no work-authorization row', () => {
    expect(host.textContent).not.toMatch(/work authori[sz]ation/i);
    const { core, ai } = readingViewsEn.summary.stack;
    const coreChips = host.querySelectorAll('.reading-chips:not(.reading-chips--ai) li');
    const aiChips = host.querySelectorAll('.reading-chips--ai li');
    expect(
      coreChips.length,
      'the stack chips render, so the row check above sees the page',
    ).toBeGreaterThan(0);
    expect(Array.from(coreChips, (chip) => chip.textContent)).toEqual(core);
    expect(Array.from(aiChips, (chip) => chip.textContent)).toEqual(ai);
  });

  it('orders the page header, stats, actions, then projects, stack and contact', () => {
    const order = [
      'h1',
      `[aria-label="${readingViewsEn.summary.statsLabel}"]`,
      '.reading-actions',
      '.reading-projects',
      '.reading-chips',
      `a[href="mailto:${social.email}"]`,
    ].map((selector) => host.querySelector(selector));
    order.forEach((node, index) => {
      expect(node, `element ${index} renders`).not.toBeNull();
      const next = order[index + 1];
      if (node && next) {
        expect(node.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    });
  });

  it('keeps the heading order h1, h2, h3 with no skipped level', () => {
    const levels = Array.from(host.querySelectorAll('h1, h2, h3'), (heading) =>
      Number(heading.tagName.slice(1)),
    );
    levels.forEach((level, index) => {
      if (index > 0) expect(level - (levels[index - 1] ?? 0)).toBeLessThanOrEqual(1);
    });
  });

  it('links to the full CV, LinkedIn and email, and has a print button', () => {
    expect(page(host).querySelector(`a[href="${READING_PATHS.cv}"]`)?.textContent).toBe(
      readingViewsEn.summary.cvLinkLabel,
    );
    expect(
      page(host).querySelector(`a[href="${social.linkedin}"]`)?.getAttribute('aria-label'),
    ).toBe(readingViewsEn.shared.hire.ariaLabel);
    expect(page(host).querySelector(`a[href="mailto:${social.email}"]`)).not.toBeNull();
    expect(
      Array.from(host.querySelectorAll('button')).some(
        (button) => button.textContent === readingViewsEn.shared.printLabel,
      ),
    ).toBe(true);
  });

  it('declares its canonical URL', () => {
    expect(summaryMetadata.alternates?.canonical).toBe(`${social.site}${READING_PATHS.summary}`);
    expect(summaryMetadata.title).toBe(readingViewsEn.summary.title);
  });
});

describe('reading view content', () => {
  it('renders the community heading as plain text when it has no link', () => {
    const { href: _omit, ...community } = cvDocumentEn.community;
    const original = cvDocumentEn.community;
    Object.assign(cvDocumentEn, { community });
    let host: HTMLElement;
    try {
      host = render(CvPage);
    } finally {
      Object.assign(cvDocumentEn, { community: original });
    }
    const heading = Array.from(host.querySelectorAll('h3')).find(
      (node) => node.textContent === community.heading,
    );
    expect(heading).toBeDefined();
    expect(heading?.querySelector('a')).toBeNull();
  });

  it('points the Career CV link at the CV view', () => {
    expect(READING_PATHS.cv).toBe('/cv');
  });

  it('has a CV label for every credential', () => {
    for (const entry of credentials) {
      expect(readingViewsEn.cv.credentialLabels[entry.label], entry.label).toBeDefined();
    }
  });

  it.each(Object.values(SITE_LOCALE))(
    'prints the %s certifications as plain words, never as snake_case tokens',
    (locale) => {
      const SNAKE_CASE = /[A-Za-z]+_[A-Za-z_]+/;
      for (const entry of credentials) {
        expect(readingViews[locale].cv.credentialBadges[entry.label], entry.label).toBeDefined();
      }
      for (const row of cvDocument[locale].certifications) {
        expect(row.value, row.key).not.toMatch(SNAKE_CASE);
      }
    },
  );

  it('hides the hire call to action and aligns the two row lists in print', () => {
    const stylesheet = parse(readComponentsCss());
    const PRINT = /^print$/;
    const [hidden] = rulesInMedia(stylesheet, PRINT, '.reading-actions-inline .reading-cta');
    expect(hidden?.selector).toContain('.reading-cta');
    expect(declValue(hidden, 'display')).toBe('none');

    const [rows] = rulesInMedia(stylesheet, PRINT, '.reading-rows li');
    expect(declValue(rows, 'grid-template-columns')).toBe(
      'var(--reading-key-width) minmax(0, 1fr)',
    );
  });

  it('marks the contact hire link so print can drop it', () => {
    const host = render(CvPage);
    const links = host.querySelectorAll('.reading-actions-inline a.reading-cta');

    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe(readingViewsEn.shared.hire.href);
  });
});
