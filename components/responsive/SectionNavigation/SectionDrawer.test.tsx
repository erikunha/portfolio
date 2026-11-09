import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMatchMedia, type MatchMediaStub } from '@/__tests__/helpers/match-media';
import { NAVIGATION, siteNavChrome } from '@/content/navigation';
import { SECTION_REGISTRY } from '@/content/section-registry';
import { SITE_LOCALE } from '@/content/site-locale';
import { DRAWER_ID } from './navigationIds';
import { SectionNavigation } from './SectionDrawer.client';
import {
  SectionNavigationProvider,
  useSectionNavigation,
} from './SectionNavigationProvider.client';

const LOCALE = SITE_LOCALE.en;
const SCROLL_LOCK = 'data-scroll-locked';
const PROJECTS = 'sec-projects';

function Trigger() {
  const { openDrawer } = useSectionNavigation();
  return (
    <button
      type="button"
      data-testid="trigger"
      onClick={(event) => openDrawer(event.currentTarget)}
    >
      open
    </button>
  );
}

function Page() {
  return (
    <SectionNavigationProvider chrome={siteNavChrome(LOCALE)} locale={LOCALE}>
      <Trigger />
      <SectionNavigation />
      <main id="main-content" tabIndex={-1}>
        {SECTION_REGISTRY.map(({ id }) => (
          <section key={id} id={id} tabIndex={-1} />
        ))}
      </main>
    </SectionNavigationProvider>
  );
}

const panel = () => document.getElementById(DRAWER_ID) as HTMLElement;
const root = () => document.documentElement;

describe('SectionNavigation drawer', () => {
  let media: MatchMediaStub;
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    media = installMatchMedia(false);
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView =
      scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    vi.stubGlobal('IntersectionObserver', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.body.dataset.motion;
  });

  function open() {
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);
    return trigger;
  }

  it('returns focus to the control that opened it when the drawer closes with Escape', () => {
    render(<Page />);
    const trigger = open();
    expect(panel().classList.contains('is-open')).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(panel().classList.contains('is-open')).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('hands focus to the chosen destination, not the trigger, when a link closes the drawer', () => {
    render(<Page />);
    const trigger = open();
    const link = screen.getAllByRole('link', { name: /projects/i })[0] as HTMLElement;
    fireEvent.click(link);
    expect(document.activeElement).toBe(document.getElementById(PROJECTS));
    expect(document.activeElement).not.toBe(trigger);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('locks page scrolling and isolates the background while open, and releases both on close', () => {
    const view = render(<Page />);
    expect(root().hasAttribute(SCROLL_LOCK)).toBe(false);
    open();
    expect(root().hasAttribute(SCROLL_LOCK)).toBe(true);
    expect(screen.getByTestId('trigger').hasAttribute('inert')).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(root().hasAttribute(SCROLL_LOCK)).toBe(false);
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    open();
    view.unmount();
    expect(root().hasAttribute(SCROLL_LOCK), 'unmounting while open releases the lock').toBe(false);
  });

  it('unlocks the page before the chosen destination is scrolled to', () => {
    render(<Page />);
    open();
    let lockedDuringJump: boolean | undefined;
    scrollIntoView.mockImplementation(() => {
      lockedDuringJump = root().hasAttribute(SCROLL_LOCK);
    });
    fireEvent.click(screen.getAllByRole('link', { name: /projects/i })[0] as HTMLElement);
    expect(lockedDuringJump).toBe(false);
  });

  it('registers no media query listener while it opens, closes and jumps', () => {
    render(<Page />);
    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    open();
    fireEvent.click(screen.getAllByRole('link', { name: /projects/i })[0] as HTMLElement);
    for (const query of media.queries()) {
      expect(
        media.listenerCount(query),
        `${query}: the drawer must stay open across a viewport change, so it listens to no media query`,
      ).toBe(0);
    }
  });

  it('labels the drawer from the navigation copy', () => {
    render(<Page />);
    expect(panel().getAttribute('aria-label')).toBe(NAVIGATION[LOCALE].copy.drawerLabel);
  });
});
