import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aboutContent } from '@/content/about';
import { profile } from '@/content/profile';
import { SITE_LOCALE } from '@/content/site-locale';
import { About } from './About';

const CODE_FONT_PX = 12;
const MONO_ADVANCE_EM = 0.6;
const NARROW_PANEL_TEXT_PX = 232;
const NARROW_LINE_CHAR_BUDGET = Math.floor(NARROW_PANEL_TEXT_PX / (CODE_FONT_PX * MONO_ADVANCE_EM));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('About r106 composition', () => {
  it('renders five framed panels with titles in their top bands', () => {
    const { container } = render(<About locale={SITE_LOCALE.en} />);
    const panels = container.querySelectorAll('.panel');
    expect(panels).toHaveLength(5);
    expect(
      [...panels].map((panel) => panel.querySelector(':scope > header h3')?.textContent),
    ).toEqual([
      '# Whoami',
      'CAT ~/.NOW',
      'LS -LA ~/RESPONSIBILITIES',
      'NPM LIST --GLOBAL',
      '$ cat src/lib/with-retry.ts',
    ]);
    expect(screen.getByRole('heading', { level: 2, name: /About/ })).toBeTruthy();
  });

  it('server-renders the Senior status in the role typer, approved principles and all eight responsibilities', () => {
    render(<About locale={SITE_LOCALE.en} />);
    expect(screen.getAllByRole('status').map((n) => n.textContent)).toContain('Senior');
    expect(screen.getByText(/LCP, INP, CLS and bundle size/)).toBeTruthy();
    expect(screen.getByText(/WCAG 2.2 AA, WAI-ARIA/)).toBeTruthy();
    const responsibilities = screen
      .getByRole('heading', { name: 'LS -LA ~/RESPONSIBILITIES' })
      .closest('.panel');
    expect(responsibilities?.querySelectorAll('[data-file]')).toHaveLength(8);
    expect(screen.getByText('performance-optimization')).toBeTruthy();
    expect(screen.getByText('taste-and-judgment')).toBeTruthy();
  });

  it('types the role in the page language', () => {
    const doc = new DOMParser().parseFromString(
      renderToStaticMarkup(<About locale={SITE_LOCALE.pt} />),
      'text/html',
    );
    expect(doc.querySelector('[data-role-pill]')?.textContent).toBe('[Sênior]');
    expect(doc.querySelector('.ab-prose [role="status"]')?.textContent).toBe('Sênior');
  });

  it('keeps the full Open to line in the server HTML with the pill in a width-reserving slot', () => {
    const doc = new DOMParser().parseFromString(
      renderToStaticMarkup(<About locale={SITE_LOCALE.en} />),
      'text/html',
    );
    const line = doc.querySelector('.ab-prose p:has(.ab-role)');
    const { role, statusPrefix, statusSuffix } = aboutContent[SITE_LOCALE.en].whoami;
    const visible = line?.querySelector('[data-role-pill]');
    expect(visible?.textContent).toBe(`[${role}]`);
    expect(line?.querySelector('.role-typer-sizer')?.getAttribute('data-role-text')).toBe(
      `[${role}]`,
    );
    expect(line?.textContent).toContain(`${statusPrefix}[${role}]`);
    expect(line?.textContent).toContain(statusSuffix);
    expect(visible?.getAttribute('aria-hidden')).toBe('true');
    expect(
      line?.querySelector('.min-w-\\[9em\\]'),
      'the fixed 9em reservation left a gap between the badge and the rest of the line',
    ).toBeNull();
    expect(doc.querySelectorAll('h1')).toHaveLength(0);
  });

  it('links the current employer in the Currently row', () => {
    const { container } = render(<About locale={SITE_LOCALE.en} />);
    const row = [...container.querySelectorAll('.ab-now dl > div')].find(
      (node) => node.querySelector('dt')?.textContent === 'Currently',
    );
    const links = row?.querySelectorAll('a') ?? [];
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe(profile.currentEmployer.url);
    expect(links[0]?.getAttribute('target')).toBe('_blank');
    expect(links[0]?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(links[0]?.textContent).toContain(profile.currentEmployer.name);
    expect(container.querySelectorAll('.ab-now a')).toHaveLength(1);
  });

  it('lists eight r106 ls -la rows with no extra legend lines', () => {
    render(<About locale={SITE_LOCALE.en} />);
    const responsibilities = screen
      .getByRole('heading', { name: 'LS -LA ~/RESPONSIBILITIES' })
      .closest('.panel');
    expect(
      responsibilities?.querySelector('[data-legend="true"]'),
      'r106 shows only the listing; the legend wrapped into broken rows',
    ).toBeNull();
    expect(responsibilities?.querySelectorAll('[data-file]')).toHaveLength(8);
  });

  it('offers the full repo link in the code panel header and no copy control', () => {
    render(<About locale={SITE_LOCALE.en} />);
    const panel = screen
      .getByRole('heading', { name: '$ cat src/lib/with-retry.ts' })
      .closest('.panel');
    const link = screen.getByRole('link', {
      name: `${aboutContent[SITE_LOCALE.en].code.repoLabel} ${aboutContent[SITE_LOCALE.en].code.repoNewTabNote}`,
    });
    expect(
      link.getAttribute('aria-label'),
      'WCAG 2.5.3: the name comes from the visible text',
    ).toBeNull();
    expect(
      panel?.querySelector('.panel-head')?.contains(link),
      'the repo link belongs in the panel header, right of the title',
    ).toBe(true);
    expect(
      screen.queryByRole('button', { name: /copy/i }),
      'the decorative code excerpt carries no copy control',
    ).toBeNull();
  });

  it('groups the stack and keeps retry code keyboard accessible on mobile', () => {
    render(<About locale={SITE_LOCALE.en} />);
    for (const group of ['AI/LLM', 'CORE', 'ANGULAR', 'LANG_DATA', 'QUALITY', 'TOOLING']) {
      expect(screen.getAllByText(group).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('LLM SYSTEMS')).toBeTruthy();
    expect(screen.getByText('PROMPT ENGINEERING')).toBeTruthy();
    expect(screen.getByText('STORYBOOK')).toBeTruthy();
    expect(screen.getByText('TANSTACK')).toBeTruthy();
    const code = screen.getByRole('region', { name: 'README code' });
    expect(code.getAttribute('tabindex')).toBe('0');
    expect(code.textContent).toContain('withRetry');
    expect(code.textContent).toContain('Math.random()');
  });

  it('wraps every retry code line to fit the narrowest 320px panel', () => {
    const code = aboutContent[SITE_LOCALE.en].code.tokens.map((token) => token.text).join('');
    const longestLine = Math.max(...code.split('\n').map((line) => line.length));
    expect(
      longestLine,
      `longest retry code line is ${longestLine} chars; the 232px panel text fits ${NARROW_LINE_CHAR_BUDGET}`,
    ).toBeLessThanOrEqual(NARROW_LINE_CHAR_BUDGET);
  });

  it('marks the About section as a dock jump target so HOME can move focus to it', () => {
    render(<About locale={SITE_LOCALE.en} />);
    expect(document.getElementById('sec-readme')?.getAttribute('tabindex')).toBe('-1');
  });

  it('excludes community tags and evidence links reserved for Career', () => {
    render(<About locale={SITE_LOCALE.en} />);
    expect(screen.queryByText("$ git tag --list 'community/*'")).toBeNull();
    expect(screen.queryByRole('link', { name: /community\/DEVOPSDAYS_CAMPINAS/ })).toBeNull();
    expect(screen.queryByText(/curated \d+(\+)? talks/)).toBeNull();
    expect(screen.queryByText(/open to CFP submissions for 2027/)).toBeNull();
    expect(screen.queryByRole('link', { name: /program/ })).toBeNull();
  });
});
