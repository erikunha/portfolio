import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { aboutContent } from '@/content/about';
import { About } from './About';

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
    expect(screen.getByRole('status').textContent).toBe('Senior');
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
    expect(line?.textContent).toBe(`${statusPrefix}${role}${role.slice(1, -1)}${statusSuffix}`);
    expect(line?.querySelector('.ab-role')?.getAttribute('aria-hidden')).toBe('true');
    expect(line?.querySelector('.ab-role')?.closest('.min-w-\\[9em\\]')).not.toBeNull();
    expect(doc.querySelectorAll('h1')).toHaveLength(0);
  });

  it('explains the four permission bit patterns beside the listing', () => {
    render(<About />);
    const responsibilities = screen
      .getByRole('heading', { name: 'LS -LA ~/RESPONSIBILITIES' })
      .closest('.ab-panel');
    const legend = responsibilities?.querySelector('[data-legend="true"]');
    expect(legend).not.toBeNull();
    expect(
      [...(legend?.querySelectorAll('.ab-permissions') ?? [])].map((n) => n.textContent),
    ).toEqual(['drwxr-xr-x', 'drwxrwxrwx', 'drwxr-x---', '-rwx------']);
    expect(legend?.textContent).toContain('i own it, you can read it, you can run against it');
    expect(legend?.textContent).toContain('explicitly shared, please write here too');
    expect(legend?.textContent).toContain(
      'owned, run only by trusted group (security, compliance)',
    );
    expect(legend?.textContent).toContain('not delegable; this is the one i bring to the room');
    expect(responsibilities?.querySelectorAll('[data-file]')).toHaveLength(7);
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

  it('excludes community tags and evidence links reserved for Career', () => {
    render(<About />);
    expect(screen.queryByText("$ git tag --list 'community/*'")).toBeNull();
    expect(screen.queryByRole('link', { name: /community\/DEVOPSDAYS_CAMPINAS/ })).toBeNull();
    expect(screen.queryByText(/curated 8 talks/)).toBeNull();
    expect(screen.queryByText(/open to CFP submissions for 2027/)).toBeNull();
    expect(screen.queryByRole('link', { name: /program/ })).toBeNull();
  });
});
