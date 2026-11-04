import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CvPage from '@/app/cv/page';
import SummaryPage from '@/app/summary/page';
import { Dock } from '@/components/responsive/Dock/Dock.client';
import {
  SectionNavigation,
  SectionNavigationProvider,
} from '@/components/responsive/SectionNavigation';
import { Hero } from '@/components/sections/Hero/Hero';
import { siteNavChrome } from '@/content/navigation';
import { SITE_LOCALE, type SiteLocale } from '@/content/site-locale';
import { social } from '@/content/social';
import { type MountedClient, mountClient } from './helpers/render';

const LOCALE: SiteLocale = SITE_LOCALE.en;
const PRIMARY_LABEL = 'HIRE_ON_LINKEDIN ↗';
const DOCK_LABEL = 'HIRE ↗';
const RAIL_LABEL = 'LinkedIn';
const ACCESSIBLE_NAME = 'Hire on LinkedIn (opens in a new tab)';
const ARROW_GLYPH = '↗';
const HIRE_HREF = social.linkedin;

class FakeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = () => [];
}

function parse(markup: string): Document {
  return new DOMParser().parseFromString(markup, 'text/html');
}

function hireLinks(root: ParentNode, scope: string): HTMLAnchorElement[] {
  return [...root.querySelectorAll<HTMLAnchorElement>(`${scope} a[href="${HIRE_HREF}"]`)];
}

function spokenWords(text: string): string {
  return text.replace(ARROW_GLYPH, '').replaceAll('_', ' ').trim().toLowerCase();
}

function expectLabelInName(link: HTMLAnchorElement): void {
  const visible = spokenWords(link.textContent ?? '');
  const name = (link.getAttribute('aria-label') ?? '').toLowerCase();
  expect(
    name.includes(visible),
    `WCAG 2.5.3: the accessible name "${name}" must contain the visible words "${visible}" in order, or voice control cannot activate the link by what it reads`,
  ).toBe(true);
}

function expectPrimaryAction(link: HTMLAnchorElement): void {
  expect(link.textContent?.trim()).toBe(PRIMARY_LABEL);
  expect(link.getAttribute('aria-label')).toBe(ACCESSIBLE_NAME);
  expectLabelInName(link);
}

describe('the LinkedIn hire action reads the same on every surface', () => {
  let mounted: MountedClient | undefined;

  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
    vi.unstubAllGlobals();
  });

  it('gives the hero action the primary label and the shared accessible name', () => {
    const doc = parse(renderToStaticMarkup(createElement(Hero, { locale: LOCALE })));
    const links = hireLinks(doc, '[data-testid="hero-ctas"]');

    expect(links.length, 'the hero renders a hire action in every layout variant').toBeGreaterThan(
      0,
    );
    for (const link of links) expectPrimaryAction(link);
  });

  it('keeps the topbar action short, like the dock, and gives it the shared accessible name', async () => {
    const { DesktopTopbar } = await import(
      '@/components/responsive/DesktopTopbar/DesktopTopbar.client'
    );
    mounted = await mountClient(
      createElement(
        SectionNavigationProvider,
        { chrome: siteNavChrome(LOCALE), locale: LOCALE },
        createElement(DesktopTopbar, { brand: null }),
      ),
    );
    const links = hireLinks(mounted.container, 'nav');

    expect(links.length, 'the topbar carries one hire action').toBeGreaterThan(0);
    for (const link of links) {
      expect(link.textContent?.trim()).toBe(DOCK_LABEL);
      expect(link.getAttribute('aria-label')).toBe(ACCESSIBLE_NAME);
      expectLabelInName(link);
      const className = link.getAttribute('class') ?? '';
      expect(className, 'the topbar action stays hidden below 1024px').toContain('hidden');
      expect(className, 'the topbar action shows from 1024px').toContain('lg:inline-flex');
    }
  });

  it('gives the summary primary action the primary label and the shared accessible name', () => {
    const doc = parse(renderToStaticMarkup(createElement(SummaryPage)));
    const links = hireLinks(doc, '.reading-actions');

    expect(links.length, 'the summary carries one primary hire action').toBeGreaterThan(0);
    for (const link of links) expectPrimaryAction(link);
  });

  it('gives the CV hire actions the primary label and the shared accessible name', () => {
    const doc = parse(renderToStaticMarkup(createElement(CvPage)));
    const links = hireLinks(doc, '.reading-actions');
    const closing = hireLinks(doc, 'section[aria-labelledby="cv-contact"]');

    expect(links.length, 'the CV carries a primary hire action').toBeGreaterThan(0);
    expect(closing.length, 'the CV closes with the hire action').toBeGreaterThan(0);
    for (const link of [...links, ...closing]) expectPrimaryAction(link);
  });

  it('keeps the dock action short and gives it the shared accessible name', () => {
    render(
      <SectionNavigationProvider chrome={siteNavChrome(LOCALE)} locale={LOCALE}>
        <SectionNavigation />
        <Dock />
      </SectionNavigationProvider>,
    );
    const dock = screen.getByRole('navigation', { name: 'primary' });
    const links = hireLinks(dock, '');

    expect(links.length, 'the dock carries one hire action').toBeGreaterThan(0);
    for (const link of links) {
      expect(link.textContent?.trim()).toBe(DOCK_LABEL);
      expect(link.getAttribute('aria-label')).toBe(ACCESSIBLE_NAME);
      expectLabelInName(link);
    }
  });

  it('keeps the rail row reading LinkedIn and gives it the shared accessible name', () => {
    render(
      <SectionNavigationProvider chrome={siteNavChrome(LOCALE)} locale={LOCALE}>
        <SectionNavigation />
        <Dock />
      </SectionNavigationProvider>,
    );
    const foot = document.querySelector('.menu-foot');
    expect(foot, 'the drawer foot carries the site links').not.toBeNull();
    const links = hireLinks(foot as ParentNode, '');

    expect(links.length, 'the rail carries one LinkedIn row').toBeGreaterThan(0);
    for (const link of links) {
      expect(link.querySelector('.nav-label')?.textContent).toBe(RAIL_LABEL);
      expect(link.getAttribute('aria-label')).toBe(ACCESSIBLE_NAME);
      expectLabelInName(link);
    }
  });
});
