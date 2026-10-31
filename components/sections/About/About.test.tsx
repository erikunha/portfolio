import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { aboutContent } from '@/content/about';
import { About } from './About';

const CODE_FONT_PX = 12;
const MONO_ADVANCE_EM = 0.6;
const NARROW_PANEL_TEXT_PX = 232;
const NARROW_LINE_CHAR_BUDGET = Math.floor(NARROW_PANEL_TEXT_PX / (CODE_FONT_PX * MONO_ADVANCE_EM));

describe('About r106 composition', () => {
  it('renders five framed panels with titles in their top bands', () => {
    const { container } = render(<About />);
    const panels = container.querySelectorAll('.ab-panel');
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

  it('server-renders the Senior status in the role typer, approved principles and all seven responsibilities', () => {
    render(<About />);
    expect(screen.getAllByRole('status').map((n) => n.textContent)).toContain('Senior');
    expect(screen.getByText(/LCP, INP, CLS and bundle size/)).toBeTruthy();
    expect(screen.getByText(/WCAG 2.2 AA, WAI-ARIA/)).toBeTruthy();
    const responsibilities = screen
      .getByRole('heading', { name: 'LS -LA ~/RESPONSIBILITIES' })
      .closest('.ab-panel');
    expect(responsibilities?.querySelectorAll('[data-file]')).toHaveLength(7);
    expect(screen.getByText('performance-optimization')).toBeTruthy();
    expect(screen.getByText('taste-and-judgment')).toBeTruthy();
  });

  it('keeps the full Open to line in the server HTML with the pill in a width-reserving slot', () => {
    const doc = new DOMParser().parseFromString(renderToStaticMarkup(<About />), 'text/html');
    const line = doc.querySelector('.ab-prose p:has(.ab-role)');
    const { role, statusPrefix, statusSuffix } = aboutContent.whoami;
    const visible = line?.querySelector('[data-role-pill]');
    expect(visible?.textContent).toBe(role);
    expect(line?.querySelector('.role-typer-sizer')?.getAttribute('data-role-text')).toBe(role);
    expect(line?.textContent).toContain(`${statusPrefix}${role}`);
    expect(line?.textContent).toContain(statusSuffix);
    expect(visible?.getAttribute('aria-hidden')).toBe('true');
    expect(
      line?.querySelector('.min-w-\\[9em\\]'),
      'the fixed 9em reservation left a gap between the badge and the rest of the line',
    ).toBeNull();
    expect(doc.querySelectorAll('h1')).toHaveLength(0);
  });

  it('lists seven r106 ls -la rows with no extra legend lines', () => {
    render(<About />);
    const responsibilities = screen
      .getByRole('heading', { name: 'LS -LA ~/RESPONSIBILITIES' })
      .closest('.ab-panel');
    expect(
      responsibilities?.querySelector('[data-legend="true"]'),
      'r106 shows only the listing; the legend wrapped into broken rows',
    ).toBeNull();
    expect(responsibilities?.querySelectorAll('[data-file]')).toHaveLength(7);
  });

  it('offers a COPY button carrying the full retry code', () => {
    render(<About />);
    const copy = screen.getByRole('button', { name: aboutContent.code.copyAccessibleLabel });
    expect(copy, 'r106 retry panel has a COPY control').toBeTruthy();
  });

  it('groups the stack and keeps retry code keyboard accessible on mobile', () => {
    render(<About />);
    for (const group of ['CORE', 'ANGULAR', 'LANG_DATA', 'QUALITY', 'TOOLING']) {
      expect(screen.getAllByText(group).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('STORYBOOK')).toBeTruthy();
    expect(screen.getByText('TANSTACK')).toBeTruthy();
    const code = screen.getByRole('region', { name: 'README code' });
    expect(code.getAttribute('tabindex')).toBe('0');
    expect(code.textContent).toContain('withRetry');
    expect(code.textContent).toContain('Math.random()');
  });

  it('wraps every retry code line to fit the narrowest 320px panel', () => {
    const code = aboutContent.code.tokens.map((token) => token.text).join('');
    const longestLine = Math.max(...code.split('\n').map((line) => line.length));
    expect(
      longestLine,
      `longest retry code line is ${longestLine} chars; the 232px panel text fits ${NARROW_LINE_CHAR_BUDGET}`,
    ).toBeLessThanOrEqual(NARROW_LINE_CHAR_BUDGET);
  });

  it('marks the About section as a dock jump target so HOME can move focus to it', () => {
    render(<About />);
    expect(document.getElementById('sec-readme')?.getAttribute('tabindex')).toBe('-1');
  });

  it('excludes community tags and evidence links reserved for Career', () => {
    render(<About />);
    expect(screen.queryByText("$ git tag --list 'community/*'")).toBeNull();
    expect(screen.queryByRole('link', { name: /community\/DEVOPSDAYS_CAMPINAS/ })).toBeNull();
    expect(screen.queryByText(/curated \d+(\+)? talks/)).toBeNull();
    expect(screen.queryByText(/open to CFP submissions for 2027/)).toBeNull();
    expect(screen.queryByRole('link', { name: /program/ })).toBeNull();
  });
});
