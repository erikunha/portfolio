import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAVIGATION } from '@/content/navigation';
import { LINKEDIN_URL } from '@/content/social-urls';
import { DRAWER_ID, SectionNavigation, SectionNavigationProvider } from '../SectionNavigation';
import { Dock } from './Dock.client';

let notify: IntersectionObserverCallback | undefined;

class FakeObserver {
  constructor(callback: IntersectionObserverCallback) {
    notify = callback;
  }
  observe = vi.fn();
  disconnect = vi.fn();
}

function reveal(id: string) {
  act(() => {
    notify?.(
      [
        { target: document.getElementById(id), isIntersecting: true },
      ] as unknown as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
  });
}

function mount() {
  return render(
    <SectionNavigationProvider>
      <SectionNavigation />
      <Dock />
      <main id="main-content" tabIndex={-1}>
        {['bio', 'sec-projects', 'sec-shell', 'sec-contact'].map((id) => (
          <section key={id} id={id} tabIndex={-1} />
        ))}
      </main>
    </SectionNavigationProvider>,
  );
}

function dock() {
  return screen.getByRole('navigation', { name: 'primary' });
}

describe('Dock', () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    notify = undefined;
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView =
      scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has exactly the five controls, in order', () => {
    mount();
    const controls = [...dock().querySelectorAll('a, button')];
    expect(controls.map((control) => control.textContent?.trim())).toEqual([
      'HOME',
      'WORK',
      'SHELL',
      'HIRE ↗',
      'MENU',
    ]);
  });

  it('links Home, Work and Shell to their sections from any route', () => {
    mount();
    expect(within(dock()).getByRole('link', { name: 'HOME' }).getAttribute('href')).toBe('/#bio');
    expect(within(dock()).getByRole('link', { name: 'WORK' }).getAttribute('href')).toBe(
      '/#sec-projects',
    );
    expect(within(dock()).getByRole('link', { name: 'SHELL' }).getAttribute('href')).toBe(
      '/#sec-shell',
    );
  });

  it('sends Hire to LinkedIn in a new tab with an explicit name', () => {
    mount();
    const hire = within(dock()).getByRole('link', {
      name: 'Hire me on LinkedIn, opens in a new tab',
    });
    expect(hire.getAttribute('href')).toBe(LINKEDIN_URL);
    expect(hire.getAttribute('target')).toBe('_blank');
    expect(hire.getAttribute('rel')).toContain('noopener');
  });

  it('marks exactly one control current, following the visible section', () => {
    mount();
    const current = () =>
      [...dock().querySelectorAll('[aria-current]')].map((el) => el.textContent?.trim());
    expect(current()).toEqual(['HOME']);
    reveal('sec-projects');
    expect(current()).toEqual(['WORK']);
    reveal('sec-shell');
    expect(current()).toEqual(['SHELL']);
    reveal('sec-contact');
    expect(current()).toEqual(['MENU']);
    expect(
      within(dock())
        .getByRole('link', { name: /Hire me/ })
        .hasAttribute('aria-current'),
    ).toBe(false);
  });

  it('announces the position in the Menu name and as a dialog trigger', () => {
    mount();
    const menu = within(dock()).getByRole('button', { name: 'MENU, section 01/9' });
    expect(menu.getAttribute('aria-haspopup')).toBe('dialog');
    expect(menu.getAttribute('aria-controls')).not.toBeNull();
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    reveal('sec-contact');
    expect(within(dock()).getByRole('button', { name: 'MENU, section 09/9' })).not.toBeNull();
  });

  it('points the Menu trigger at the drawer element it controls', () => {
    mount();
    const menu = within(dock()).getByRole('button', { name: /^MENU/ });
    const controls = menu.getAttribute('aria-controls');
    expect(controls).not.toBeNull();
    const drawer = document.getElementById(controls as string);
    expect(drawer).not.toBeNull();
    expect(drawer?.getAttribute('aria-label')).toBe(NAVIGATION.copy.drawerLabel);
  });

  it('opens the drawer from Menu and gives focus back to it on Escape', () => {
    mount();
    const menu = within(dock()).getByRole('button', { name: /^MENU/ });
    menu.focus();
    fireEvent.click(menu);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(DRAWER_ID)?.getAttribute('role')).toBe('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(menu);
  });

  it('scrolls to the chosen section and focuses it', () => {
    mount();
    fireEvent.click(within(dock()).getByRole('link', { name: 'WORK' }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(document.activeElement).toBe(document.getElementById('sec-projects'));
  });

  it('does not smooth-scroll when the user prefers reduced motion', () => {
    window.matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    mount();
    fireEvent.click(within(dock()).getByRole('link', { name: 'SHELL' }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('carries the progress-strip target and the label from content', () => {
    mount();
    expect(dock().hasAttribute('data-position-target')).toBe(true);
    expect(dock().classList.contains('dock')).toBe(true);
    expect(NAVIGATION.dock).toHaveLength(5);
  });
});
