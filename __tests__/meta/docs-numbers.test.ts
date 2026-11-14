import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { YEARS_OF_EXPERIENCE_LABEL } from '../../content/profile';
import { projects } from '../../content/projects';
import { SITE_LOCALE } from '../../content/site-locale';
import { E2E_PROJECT_COUNT } from '../../playwright.config';
import { COVERAGE_THRESHOLDS } from '../../vitest.config';

// Why this gate exists. The README is the first document a hiring reviewer
// opens, and it carries numbers: how many E2E projects, how many design-system
// pages, what the coverage floor is, what the Lighthouse thresholds are. A
// number in a document is a claim, and a claim that no code holds rots the
// moment the code moves: the doc keeps saying "eight projects" while the
// matrix runs nine, and the reader has no way to tell.
//
// The design-system counts were already held this way
// (__tests__/design-system-doc-counts.test.ts). This file holds the rest of
// the README's numbers, so "the documentation states what the code does" is
// a property with a gate behind it instead of a habit.

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const read = (relativePath: string): string =>
  readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8');

const readJson = <T>(relativePath: string): T => JSON.parse(read(relativePath)) as T;

const NUMBER_WORDS: Record<number, string> = {
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  11: 'eleven',
  12: 'twelve',
};

const wordFor = (count: number): string => {
  const word = NUMBER_WORDS[count];
  if (word === undefined) {
    throw new Error(
      `no English word for ${count} in this file's NUMBER_WORDS table: the README states the count as a word, so the gate needs that word to check it. Add it here rather than changing the README to a digit, the two forms are both allowed, and the gate has to know which one it is looking for.`,
    );
  }
  return word;
};

const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

const README = read('README.md');
const ARCHITECTURE = read('ARCHITECTURE.md');
const DOMAIN_DOC = read('docs/02-domain.md');

const countDesignSystemPages = (): number => {
  const dir = path.join(REPO_ROOT, 'app', '(en)', 'design-system');
  const walk = (current: string): number =>
    readdirSync(current, { withFileTypes: true }).reduce((total, entry) => {
      if (entry.isDirectory()) return total + walk(path.join(current, entry.name));
      return entry.name === 'page.mdx' ? total + 1 : total;
    }, 0);
  return walk(dir);
};

type LighthouseAssertions = Record<string, [string, { minScore?: number }] | string>;

const lighthouseAssertions = (file: string): LighthouseAssertions =>
  readJson<{ ci: { assert: { assertions: LighthouseAssertions } } }>(file).ci.assert.assertions;

const lighthouseUrls = (file: string): string[] =>
  readJson<{ ci: { collect: { url: string[] } } }>(file).ci.collect.url;

const minScore = (assertions: LighthouseAssertions, key: string): number => {
  const entry = assertions[key];
  if (entry === undefined || typeof entry === 'string') {
    throw new Error(
      `the Lighthouse config no longer asserts "${key}" as a scored category, so the README cannot state its threshold: add the assertion back or restate the README line.`,
    );
  }
  return entry[1].minScore ?? 0;
};

describe('meta: the README states the numbers the code holds', () => {
  it('states the years of experience the site itself states', () => {
    expect(
      README,
      `the README states Erik's years of experience and content/profile.ts holds ${YEARS_OF_EXPERIENCE_LABEL} as the one constant every surface derives from. A README that says a different number than the site advertises is a contradiction a reviewer can find in two clicks.`,
    ).toContain(`${YEARS_OF_EXPERIENCE_LABEL} of production software`);
  });

  it('states the E2E project count the matrix actually runs', () => {
    expect(
      README,
      `the README says how many Playwright projects the E2E matrix runs and playwright.config.ts defines ${E2E_PROJECT_COUNT}. The count is stated as a word ("${wordFor(E2E_PROJECT_COUNT)}"), so a ninth project has to be counted there too.`,
    ).toContain(`${wordFor(E2E_PROJECT_COUNT)} Playwright projects`);
  });

  it('states the design-system documentation page count the pages directory holds', () => {
    const pages = countDesignSystemPages();

    expect(
      README,
      `the README states how many /design-system documentation pages there are and the directory holds ${pages}. A page added under app/(en)/design-system/ has to be counted there.`,
    ).toContain(`${pages} \`/design-system\` documentation pages`);
  });

  it('states the coverage floor the coverage gate enforces', () => {
    expect(
      README,
      `the README states the unit-test coverage floor and vitest.config.ts gates lines at ${COVERAGE_THRESHOLDS.lines}% and branches at ${COVERAGE_THRESHOLDS.branches}%. Lowering the gate has to be restated there.`,
    ).toContain(`${COVERAGE_THRESHOLDS.lines}% lines, ${COVERAGE_THRESHOLDS.branches}% branches`);
  });

  it('states the Lighthouse category thresholds the configs assert', () => {
    const desktop = lighthouseAssertions('lighthouserc.json');
    const mobile = lighthouseAssertions('lighthouserc.mobile.json');

    const performanceDesktop = Math.round(minScore(desktop, 'categories:performance') * 100);
    const performanceMobile = Math.round(minScore(mobile, 'categories:performance') * 100);
    const accessibility = Math.round(minScore(desktop, 'categories:accessibility') * 100);
    const seo = Math.round(minScore(desktop, 'categories:seo') * 100);
    const bestPractices = Math.round(minScore(desktop, 'categories:best-practices') * 100);

    expect(
      README,
      `the README states the Lighthouse thresholds the configs assert: performance ${performanceDesktop} desktop / ${performanceMobile} mobile, accessibility ${accessibility}, SEO ${seo}, best practices ${bestPractices}. A threshold moved in lighthouserc.json has to be restated there.`,
    ).toContain(
      `performance ≥${performanceDesktop} desktop / ≥${performanceMobile} mobile, accessibility and SEO = ${accessibility}, best practices ≥${bestPractices}`,
    );
  });

  it('states the Lighthouse route count the configs collect', () => {
    const desktop = lighthouseUrls('lighthouserc.json');
    const mobile = lighthouseUrls('lighthouserc.mobile.json');

    expect(
      desktop.length,
      'the desktop and mobile Lighthouse configs collect a different number of URLs, so the README cannot state one count for both: restate it as the count of each, or make the configs collect the same set.',
    ).toBe(mobile.length);

    expect(
      README,
      `the README states how many routes the Lighthouse config gates and lighthouserc.json collects ${desktop.length}. "Every route" is not the same claim: the pt-BR reading twins (/pt/cv and /pt/summary) are routes that neither config collects.`,
    ).toContain(`${desktop.length} routes the Lighthouse config lists`);

    expect(
      README,
      'the README claims the Lighthouse gates run on every route, but the configs collect a named subset: the pt-BR reading twins (/pt/cv and /pt/summary) are routes that neither config collects, so "every route" is a claim the configs do not back. State the count the configs collect instead.',
    ).not.toContain('on every route');
  });

  it('states the project card count the content holds', () => {
    const cards = projects[SITE_LOCALE.en].length;

    expect(
      ARCHITECTURE,
      `ARCHITECTURE.md states how many project cards the Projects section renders and content/projects.ts holds ${cards}. A card added to the content has to be counted in the document.`,
    ).toContain(`Its ${wordFor(cards)} cards`);
    expect(ARCHITECTURE).toContain(`# ${wordFor(cards)} project cards`);

    expect(
      DOMAIN_DOC,
      `docs/02-domain.md states how many projects the content layer holds and content/projects.ts holds ${cards}.`,
    ).toContain(`${capitalize(wordFor(cards))} projects`);
  });

  it('names the CI jobs that hold the performance claim', () => {
    const ci = read('.github/workflows/ci.yml');

    for (const job of ['performance', 'build']) {
      expect(
        ci,
        `the README says the performance and bundle claims are held by gates in the "${job}" job, and .github/workflows/ci.yml has no "${job}" job: the claim lost its referent, which is what this change set out to remove.`,
      ).toContain(`${job}:`);
    }

    expect(
      ci,
      'the README says the bundle and per-route JS budgets are gates in the build job; the workflow does not run them there',
    ).toContain('check-bundle-size.mjs');
    expect(ci).toContain('check-route-js.mjs');
  });
});
