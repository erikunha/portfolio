import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CvPage, { metadata as cvMetadata } from '@/app/cv/page';
import SummaryPage, { metadata as summaryMetadata } from '@/app/summary/page';
import { credentials } from '@/content/credentials';
import { education } from '@/content/education';
import { gitLog } from '@/content/git-log';
import { heroStats } from '@/content/perf-receipts';
import { profile } from '@/content/profile';
import {
  cvDocument,
  READING_PATHS,
  readingViews,
  summaryDocument,
  toSentence,
  withoutFragment,
} from '@/content/reading-views';
import { social } from '@/content/social';

function render(page: () => React.ReactElement) {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(page());
  return host;
}

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

describe('withoutFragment', () => {
  it('removes the fragment from the source', () => {
    expect(withoutFragment('keep this drop', ' drop')).toBe('keep this');
  });

  it('throws when the fragment has drifted out of the source', () => {
    expect(() => withoutFragment('keep this', 'gone')).toThrow(/expected fragment missing/);
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
    const headings = Object.values(readingViews.cv.headings);
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
    expect(experience).toHaveLength(gitLog.length);
    for (const job of cvDocument.experience) {
      expect(host.textContent).toContain(job.company);
      for (const bullet of job.bullets) {
        expect(bullet).toMatch(/^[A-Z0-9]/);
        expect(bullet).toMatch(/[.!?)]$/);
        expect(bullet).not.toContain(';');
      }
    }
  });

  it('shows every certification and degree row', () => {
    for (const entry of credentials) expect(host.textContent).toContain(entry.evidence);
    for (const entry of education) expect(host.textContent).toContain(entry.degree);
  });

  it('keeps the summary free of the header facts and the authorization sentence', () => {
    expect(cvDocument.summary.length).toBeGreaterThan(40);

    expect(cvDocument.summary).not.toContain(profile.title);
  });

  it('opens external links in a new tab with a hint for screen readers', () => {
    const linkedin = host.querySelector(`a[href="${social.linkedin}"]`);
    expect(linkedin?.getAttribute('target')).toBe('_blank');
    expect(linkedin?.getAttribute('rel')).toBe(readingViews.shared.newTabRel);
    const external = Array.from(host.querySelectorAll('a[target="_blank"]'));
    expect(external.length).toBeGreaterThan(0);
    for (const link of external) {
      const named = link.getAttribute('aria-label') ?? link.textContent;
      expect(named).toMatch(/new tab/);
    }
  });

  it('links to the email, the summary view and a print button', () => {
    expect(host.querySelector(`a[href="mailto:${social.email}"]`)).not.toBeNull();
    expect(host.querySelector(`a[href="${READING_PATHS.summary}"]`)).not.toBeNull();
    const print = Array.from(host.querySelectorAll('button')).find(
      (button) => button.textContent === readingViews.shared.printLabel,
    );
    expect(print).toBeDefined();
  });

  it('marks the chrome so print can hide it, and gives the skip link a target', () => {
    expect(host.querySelector('.reading-bar')).not.toBeNull();
    expect(host.querySelector('.reading-actions')).not.toBeNull();
    const skip = host.querySelector('a.skip-to-content');
    expect(skip?.getAttribute('href')).toBe('#main-content');
    expect(host.querySelector('main#main-content')).not.toBeNull();
  });

  it('describes itself as a profile page for search engines', () => {
    const script = host.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script?.textContent ?? '{}');
    expect(data['@type']).toBe('ProfilePage');
    expect(data.url).toBe(`${social.site}${READING_PATHS.cv}`);
  });

  it('declares its canonical URL and social card', () => {
    expect(cvMetadata.alternates?.canonical).toBe(`${social.site}${READING_PATHS.cv}`);
    expect(cvMetadata.title).toBe(readingViews.cv.title);
    expect(cvMetadata.twitter).toMatchObject({ card: 'summary_large_image' });
  });
});

describe('summary reading view', () => {
  const host = render(SummaryPage);

  it('has one h1 with the name', () => {
    expect(host.querySelectorAll('h1')).toHaveLength(1);
    expect(host.querySelector('h1')?.textContent).toBe(profile.displayName);
  });

  it('shows every hero number with their labels', () => {
    const tiles = host.querySelectorAll(
      `[aria-label="${readingViews.summary.statsLabel}"] .stat-tile`,
    );
    expect(tiles).toHaveLength(heroStats.length);
    heroStats.forEach((stat, index) => {
      expect(tiles[index]?.textContent).toContain(stat.value);
      expect(tiles[index]?.textContent).toContain(stat.label);
    });
  });

  it('shows the chosen projects with a headline stat each', () => {
    const panels = host.querySelectorAll('.reading-projects .terminal-panel');
    expect(panels).toHaveLength(readingViews.summary.projectNames.length);
    for (const project of summaryDocument.projects) {
      expect(host.textContent).toContain(project.name);
      expect(host.textContent).toContain(project.value);
    }
  });

  it('shows the stack chips and no work-authorization row', () => {
    expect(host.querySelectorAll('.reading-rows li')).toHaveLength(0);
    expect(host.textContent).not.toContain('Work authorization');
    expect(host.querySelectorAll('.reading-chips li')).toHaveLength(
      readingViews.summary.stack.length,
    );
  });

  it('links to the full CV, LinkedIn and email, and has a print button', () => {
    expect(host.querySelector(`a[href="${READING_PATHS.cv}"]`)?.textContent).toBe(
      readingViews.summary.cvLinkLabel,
    );
    expect(host.querySelector(`a[href="${social.linkedin}"]`)?.getAttribute('aria-label')).toBe(
      readingViews.shared.hire.ariaLabel,
    );
    expect(host.querySelector(`a[href="mailto:${social.email}"]`)).not.toBeNull();
    expect(
      Array.from(host.querySelectorAll('button')).some(
        (button) => button.textContent === readingViews.shared.printLabel,
      ),
    ).toBe(true);
  });

  it('declares its canonical URL', () => {
    expect(summaryMetadata.alternates?.canonical).toBe(`${social.site}${READING_PATHS.summary}`);
    expect(summaryMetadata.title).toBe(readingViews.summary.title);
  });
});

describe('reading view content', () => {
  it('renders the community heading as plain text when it has no link', () => {
    const { href: _omit, ...community } = cvDocument.community;
    const original = cvDocument.community;
    Object.assign(cvDocument, { community });
    let host: HTMLElement;
    try {
      host = render(CvPage);
    } finally {
      Object.assign(cvDocument, { community: original });
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
      expect(readingViews.cv.credentialLabels[entry.label], entry.label).toBeDefined();
    }
  });
});
