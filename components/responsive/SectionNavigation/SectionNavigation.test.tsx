import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAVIGATION } from '@/content/navigation';
import { SECTION_REGISTRY } from '@/content/section-registry';
import {
  SectionNavigation,
  SectionNavigationProvider,
  useSectionNavigation,
} from './SectionNavigation.client';

class FakeObserver {
  static instances: FakeObserver[] = [];
  observed = new Set<Element>();
  constructor(readonly callback: IntersectionObserverCallback) {
    FakeObserver.instances.push(this);
  }
  observe = (element: Element) => {
    this.observed.add(element);
  };
  unobserve = (element: Element) => {
    this.observed.delete(element);
  };
  disconnect = () => {
    this.observed.clear();
  };
  takeRecords = () => [];
}

function report(...entries: Array<[Element | null, boolean]>) {
  const observer = FakeObserver.instances.at(-1);
  act(() => {
    observer?.callback(
      entries.map(([target, isIntersecting]) => ({
        target,
        isIntersecting,
      })) as IntersectionObserverEntry[],
      observer as unknown as IntersectionObserver,
    );
  });
}

function reveal(target: Element | null) {
  report([target, true]);
}

function leave(target: Element | null) {
  report([target, false]);
}

type MediaListener = (event: { matches: boolean }) => void;
let reducedMotion = false;
let drawerViewport = true;
const mediaListeners = new Set<MediaListener>();

function stubMatchMedia() {
  window.matchMedia = vi.fn((query: string) => ({
    get matches() {
      if (query.includes('prefers-reduced-motion')) return reducedMotion;
      return drawerViewport;
    },
    media: query,
    addEventListener: (_: string, listener: MediaListener) => mediaListeners.add(listener),
    removeEventListener: (_: string, listener: MediaListener) => mediaListeners.delete(listener),
  })) as unknown as typeof window.matchMedia;
}

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

function Page({ withHome = true }: { withHome?: boolean }) {
  return (
    <SectionNavigationProvider>
      <Trigger />
      <SectionNavigation />
      <main id="main-content" tabIndex={-1}>
        {SECTION_REGISTRY.filter(({ id }) => withHome || id !== 'bio').map(({ id }) => (
          <section key={id} id={id} tabIndex={-1} />
        ))}
        {withHome ? null : <section data-testid="hero-mobile" tabIndex={-1} />}
      </main>
    </SectionNavigationProvider>
  );
}

function panel() {
  return document.getElementById('section-drawer') as HTMLElement;
}

function navLink(name: string) {
  return within(screen.getByRole('navigation', { name: NAVIGATION.copy.navLabel })).getByRole(
    'link',
    { name },
  );
}

describe('SectionNavigation', () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    FakeObserver.instances = [];
    mediaListeners.clear();
    reducedMotion = false;
    drawerViewport = true;
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    stubMatchMedia();
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView =
      scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    delete document.body.dataset.motion;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists the nine registry destinations in order, each linking to its section', () => {
    render(<Page />);
    const links = within(screen.getByRole('navigation', { name: 'Page sections' })).getAllByRole(
      'link',
    );
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      SECTION_REGISTRY.map(({ id }) => `/#${id}`),
    );
    expect(links.map((link) => link.querySelector('.nav-label')?.textContent)).toEqual(
      SECTION_REGISTRY.map(({ label }) => label),
    );
  });

  it('groups the destinations under labelled headings', () => {
    render(<Page />);
    for (const group of NAVIGATION.groups) {
      const region = screen.getByRole('list', { name: group.title });
      expect(within(region).getAllByRole('link')).toHaveLength(group.sectionIds.length);
    }
  });

  it('marks Home current first, then only the section the observer reports', () => {
    render(<Page />);
    expect(navLink('Home').getAttribute('aria-current')).toBe('location');
    reveal(document.getElementById('sec-projects'));
    expect(navLink('Projects').getAttribute('aria-current')).toBe('location');
    expect(
      document.querySelectorAll('#section-nav [aria-current]'),
      'exactly one destination is current',
    ).toHaveLength(1);
  });

  it('observes every registry section with one observer and maps the mobile hero to Home', () => {
    render(<Page withHome={false} />);
    expect(FakeObserver.instances).toHaveLength(1);
    expect(FakeObserver.instances[0]?.observed.size).toBe(SECTION_REGISTRY.length);
    reveal(document.getElementById('sec-contact'));
    expect(navLink('Contact').getAttribute('aria-current')).toBe('location');
    reveal(screen.getByTestId('hero-mobile'));
    expect(navLink('Home').getAttribute('aria-current')).toBe('location');
  });

  it('marks the earliest section in the document when several intersect together', () => {
    render(<Page />);
    report(
      [document.getElementById('sec-projects'), true],
      [document.getElementById('sec-contact'), true],
    );
    expect(navLink('Projects').getAttribute('aria-current')).toBe('location');
    expect(navLink('Contact').hasAttribute('aria-current')).toBe(false);
  });

  it('keeps the last current section when nothing intersects', () => {
    render(<Page />);
    reveal(document.getElementById('sec-projects'));
    leave(document.getElementById('sec-projects'));
    expect(navLink('Projects').getAttribute('aria-current')).toBe('location');
  });

  it('disconnects the observer on unmount', () => {
    const view = render(<Page />);
    const observer = FakeObserver.instances[0];
    view.unmount();
    expect(observer?.observed.size).toBe(0);
  });

  it('renders without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Page />);
    expect(navLink('Home').getAttribute('aria-current')).toBe('location');
  });

  it('jumps to a section with smooth scrolling and moves focus to it', () => {
    render(<Page />);
    const click = fireEvent.click(navLink('Projects'));
    expect(click, 'default navigation is replaced by the scripted jump').toBe(false);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(document.activeElement).toBe(document.getElementById('sec-projects'));
  });

  it('corrects once when deferred sections shift the target before scrolling settles', () => {
    render(<Page />);
    const target = document.getElementById('sec-contact') as HTMLElement;
    const rect = vi.spyOn(target, 'getBoundingClientRect');
    fireEvent.click(navLink('Contact'));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    rect.mockReturnValue({ top: 2800 } as DOMRect);
    window.dispatchEvent(new Event('scrollend'));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event('scrollend'));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('keeps one pending correction: a newer jump replaces the older one', () => {
    render(<Page />);
    const contact = document.getElementById('sec-contact') as HTMLElement;
    const projects = document.getElementById('sec-projects') as HTMLElement;
    vi.spyOn(contact, 'getBoundingClientRect').mockReturnValue({ top: 2800 } as DOMRect);
    vi.spyOn(projects, 'getBoundingClientRect').mockReturnValue({ top: 2800 } as DOMRect);
    fireEvent.click(navLink('Contact'));
    fireEvent.click(navLink('Projects'));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event('scrollend'));
    expect(scrollIntoView).toHaveBeenCalledTimes(3);
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(projects);
    window.dispatchEvent(new Event('scrollend'));
    expect(scrollIntoView).toHaveBeenCalledTimes(3);
  });

  it('drops the pending correction when the next jump is Home', () => {
    render(<Page />);
    const contact = document.getElementById('sec-contact') as HTMLElement;
    vi.spyOn(contact, 'getBoundingClientRect').mockReturnValue({ top: 2800 } as DOMRect);
    fireEvent.click(navLink('Contact'));
    fireEvent.click(navLink('Home'));
    window.dispatchEvent(new Event('scrollend'));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('leaves a settled jump alone', () => {
    render(<Page />);
    const target = document.getElementById('sec-contact') as HTMLElement;
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ top: 60 } as DOMRect);
    fireEvent.click(navLink('Contact'));
    window.dispatchEvent(new Event('scrollend'));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['prefers-reduced-motion', () => (reducedMotion = true)],
    ['the motion toggle', () => (document.body.dataset.motion = 'reduce')],
  ])('does not smooth-scroll under %s', (_, enable) => {
    enable();
    render(<Page />);
    fireEvent.click(navLink('Career'));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('sends Home to the top of the page and focuses the main landmark', () => {
    render(<Page />);
    fireEvent.click(navLink('Home'));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(document.activeElement).toBe(document.getElementById('main-content'));
  });

  it('leaves the browser default alone when the target is missing or the click is modified', () => {
    render(<Page />);
    document.getElementById('sec-guitar')?.remove();
    expect(fireEvent.click(navLink('Guitar and mixer'))).toBe(true);
    expect(fireEvent.click(navLink('About'), { metaKey: true })).toBe(true);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('links to the design system and to LinkedIn in a new tab', () => {
    render(<Page />);
    const foot = document.querySelector('.menu-foot') as HTMLElement;
    const ds = within(foot).getByRole('link', { name: 'DESIGN_SYSTEM' });
    expect(ds.getAttribute('href')).toBe('/design-system');
    const linkedin = within(foot).getByRole('link', { name: /LinkedIn/ });
    expect(linkedin.getAttribute('target')).toBe('_blank');
    expect(linkedin.getAttribute('rel')).toContain('noopener');
    expect(linkedin.textContent).toContain('(opens in a new tab)');
  });

  describe('drawer', () => {
    function open() {
      const trigger = screen.getByTestId('trigger');
      trigger.focus();
      fireEvent.click(trigger);
      return trigger;
    }

    it('is a closed complementary landmark until opened', () => {
      render(<Page />);
      expect(screen.getByRole('complementary', { name: 'Section menu' })).toBe(panel());
      expect(panel().hasAttribute('aria-modal')).toBe(false);
      expect(panel().classList.contains('is-open')).toBe(false);
    });

    it('opens as a modal dialog, isolates the background and focuses the close control', () => {
      render(<Page />);
      open();
      expect(panel().getAttribute('role')).toBe('dialog');
      expect(panel().getAttribute('aria-modal')).toBe('true');
      expect(panel().getAttribute('aria-label')).toBe('Section menu');
      expect(screen.getByTestId('trigger').hasAttribute('inert')).toBe(true);
      expect(document.getElementById('main-content')?.hasAttribute('inert')).toBe(true);
      expect(panel().closest('[inert]')).toBeNull();
      expect(document.querySelector('.menu-scrim')?.closest('[inert]')).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: '[ X ] CLOSE' }));
    });

    it('closes on Escape, restores the background and returns focus to the trigger', () => {
      render(<Page />);
      const trigger = open();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.getByRole('complementary', { name: 'Section menu' })).toBe(panel());
      expect(document.querySelectorAll('[inert]')).toHaveLength(0);
      expect(document.activeElement).toBe(trigger);
    });

    it('closes from the close control and from the scrim', () => {
      render(<Page />);
      const trigger = open();
      fireEvent.click(screen.getByRole('button', { name: '[ X ] CLOSE' }));
      expect(panel().classList.contains('is-open')).toBe(false);
      expect(document.activeElement).toBe(trigger);
      open();
      fireEvent.click(document.querySelector('.menu-scrim') as HTMLElement);
      expect(panel().classList.contains('is-open')).toBe(false);
      expect(document.activeElement).toBe(trigger);
    });

    it('keeps Tab and Shift+Tab inside the drawer', () => {
      render(<Page />);
      open();
      const close = screen.getByRole('button', { name: '[ X ] CLOSE' });
      const footLinks = panel().querySelectorAll<HTMLElement>('.menu-foot a');
      const last = footLinks[footLinks.length - 1] as HTMLElement;
      last.focus();
      const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      document.dispatchEvent(forward);
      expect(forward.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(close);
      const backward = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(backward);
      expect(backward.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(last);
    });

    it('lets Tab move normally between inner controls', () => {
      render(<Page />);
      open();
      navLink('About').focus();
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      document.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });

    it('closes after a destination is chosen and focuses it instead of the trigger', () => {
      render(<Page />);
      open();
      fireEvent.click(navLink('Projects'));
      expect(panel().classList.contains('is-open')).toBe(false);
      expect(document.querySelectorAll('[inert]')).toHaveLength(0);
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      expect(document.activeElement).toBe(document.getElementById('sec-projects'));
    });

    it('closes when the viewport grows past the drawer breakpoint', () => {
      render(<Page />);
      open();
      drawerViewport = false;
      act(() => {
        for (const listener of [...mediaListeners]) listener({ matches: false });
      });
      expect(panel().classList.contains('is-open')).toBe(false);
      expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    });

    it('locks page scrolling while open and releases it on every way out', () => {
      const root = document.documentElement;
      const view = render(<Page />);
      expect(root.hasAttribute('data-scroll-locked')).toBe(false);
      open();
      expect(root.hasAttribute('data-scroll-locked')).toBe(true);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(root.hasAttribute('data-scroll-locked')).toBe(false);
      open();
      fireEvent.click(navLink('Projects'));
      expect(root.hasAttribute('data-scroll-locked')).toBe(false);
      open();
      expect(root.hasAttribute('data-scroll-locked')).toBe(true);
      view.unmount();
      expect(root.hasAttribute('data-scroll-locked')).toBe(false);
    });

    it('unlocks the page before jumping to the chosen destination', () => {
      render(<Page />);
      open();
      let lockedDuringJump: boolean | undefined;
      scrollIntoView.mockImplementation(() => {
        lockedDuringJump = document.documentElement.hasAttribute('data-scroll-locked');
      });
      fireEvent.click(navLink('Projects'));
      expect(lockedDuringJump).toBe(false);
    });

    it('releases the background when unmounted while open', () => {
      const view = render(<Page />);
      open();
      view.unmount();
      expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    });
  });

  describe('rail', () => {
    it('expands and collapses from its toggle', () => {
      render(<Page />);
      const toggle = screen.getByRole('button', { name: 'Open section menu' });
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(toggle.getAttribute('aria-controls')).toBe('section-drawer');
      fireEvent.click(toggle);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(panel().classList.contains('is-expanded')).toBe(true);
      fireEvent.click(toggle);
      expect(panel().classList.contains('is-expanded')).toBe(false);
    });

    it('collapses on Escape, returns focus to the toggle and stays collapsed until re-entered', () => {
      render(<Page />);
      const toggle = screen.getByRole('button', { name: 'Open section menu' });
      fireEvent.click(toggle);
      navLink('About').focus();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(toggle);
      expect(panel().classList.contains('is-dismissed')).toBe(true);
      fireEvent.mouseEnter(panel());
      expect(panel().classList.contains('is-dismissed')).toBe(false);
    });

    it('collapses when the page outside the rail is clicked', () => {
      render(<Page />);
      const toggle = screen.getByRole('button', { name: 'Open section menu' });
      fireEvent.click(toggle);
      fireEvent.click(document.getElementById('main-content') as HTMLElement);
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
    });

    it('dismisses the rail after following a section link, until the rail is re-entered', () => {
      render(<Page />);
      fireEvent.click(navLink('About'));
      expect(panel().classList.contains('is-dismissed')).toBe(true);
      fireEvent.mouseEnter(panel());
      expect(panel().classList.contains('is-dismissed')).toBe(false);
    });
  });
});
