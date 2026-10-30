import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAVIGATION } from '@/content/navigation';
import { SECTION_REGISTRY } from '@/content/section-registry';
import {
  DRAWER_ID,
  IndexTrigger,
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

const MOTION_STORAGE_KEY = 'erik.motion';
let reducedMotion = false;

function stubMatchMedia() {
  window.matchMedia = vi.fn((query: string) => ({
    get matches() {
      if (query.includes('prefers-reduced-motion')) return reducedMotion;
      return false;
    },
    media: query,
    addEventListener: () => {
      throw new Error(
        'stubMatchMedia does not model media query listeners: model the query in the stub before the component listens to it',
      );
    },
    removeEventListener: () => undefined,
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

function Page({
  withHome = true,
  withIndexTrigger = false,
}: {
  withHome?: boolean;
  withIndexTrigger?: boolean;
}) {
  return (
    <SectionNavigationProvider>
      {withIndexTrigger ? <IndexTrigger /> : null}
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

function IndexPage() {
  return (
    <SectionNavigationProvider>
      <IndexTrigger />
      <SectionNavigation />
      <main id="main-content" tabIndex={-1}>
        {SECTION_REGISTRY.map(({ id }) => (
          <section key={id} id={id} tabIndex={-1} />
        ))}
      </main>
    </SectionNavigationProvider>
  );
}

function panel() {
  return document.getElementById(DRAWER_ID) as HTMLElement;
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
    reducedMotion = false;
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    stubMatchMedia();
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView =
      scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    delete document.body.dataset.motion;
    localStorage.removeItem(MOTION_STORAGE_KEY);
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
    render(<Page />);
    enable();
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

  it('lists the reading views and the design system in the drawer foot', () => {
    render(<Page />);
    const foot = document.querySelector('.menu-foot') as HTMLElement;
    const hrefs = [...foot.querySelectorAll('a')].map((link) => link.getAttribute('href'));

    expect(hrefs).toEqual([
      '/cv',
      '/summary',
      '/design-system',
      'https://www.linkedin.com/in/erikunha/',
    ]);
    expect(
      [...foot.querySelectorAll('a')].map((link) => link.querySelector('.nav-label')?.textContent),
    ).toEqual(['VIEW_CV', '30S_SUMMARY', 'DESIGN_SYSTEM', 'LinkedIn (opens in a new tab)']);
  });

  it('counts the destinations in the drawer head', () => {
    render(<Page />);
    const badge = document.querySelector('.menu-badge');

    expect(badge?.querySelector('[aria-hidden="true"]')?.textContent).toBe(
      String(SECTION_REGISTRY.length),
    );
    expect(badge?.textContent).toContain(`${SECTION_REGISTRY.length} sections`);
  });

  it('offers a search row that reports the drawer it controls', () => {
    render(<Page />);
    const search = document.querySelector('.menu-search') as HTMLButtonElement;

    expect(search).not.toBeNull();
    expect(search.getAttribute('aria-controls')).toBe(DRAWER_ID);
    expect(search.getAttribute('aria-keyshortcuts')).toBe('Control+K Meta+K');
    expect(search.getAttribute('aria-expanded')).toBe('false');
    expect(search.textContent).toContain(NAVIGATION.copy.searchLabel);
  });

  it('toggles the drawer from the search row', () => {
    render(<Page />);
    const search = document.querySelector('.menu-search') as HTMLButtonElement;

    fireEvent.click(search);
    expect(panel().classList.contains('is-open')).toBe(true);
    expect(search.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(search);
    expect(panel().classList.contains('is-open')).toBe(false);
  });

  it('opens the drawer on the search shortcut', () => {
    render(<Page />);
    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    expect(panel().classList.contains('is-open')).toBe(true);
  });

  it('shares one motion state between the drawer toggle and the topbar toggle', () => {
    render(<Page />);
    const toggle = document.querySelector('.menu-motion') as HTMLButtonElement;

    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.textContent).toContain(NAVIGATION.copy.motionOn);

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.textContent).toContain(NAVIGATION.copy.motionOff);
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
      expect(document.activeElement?.getAttribute('aria-current')).toBeTruthy();
    });

    it('closes on Escape, restores the background and returns focus to the trigger', () => {
      render(<Page />);
      const trigger = open();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.getByRole('complementary', { name: 'Section menu' })).toBe(panel());
      expect(document.querySelectorAll('[inert]')).toHaveLength(0);
      expect(document.activeElement).toBe(trigger);
    });

    it('returns focus to a rendered INDEX trigger when the trigger that opened the drawer is gone', () => {
      render(<Page withIndexTrigger />);
      const trigger = screen.getByTestId('trigger');
      trigger.focus();
      fireEvent.click(trigger);
      trigger.style.display = 'none';

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(
        document.activeElement,
        'focus must land on a rendered INDEX trigger when the element that opened the drawer is not rendered',
      ).toBe(screen.getByRole('button', { name: new RegExp(NAVIGATION.copy.indexLabel) }));
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
      const controls = panel().querySelectorAll<HTMLElement>('a[href], button');
      const last = controls[controls.length - 1] as HTMLElement;
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

  describe('index trigger', () => {
    function indexButton() {
      return screen.getByRole('button', { name: new RegExp(NAVIGATION.copy.indexLabel) });
    }

    it('names the drawer it controls and reports it closed', () => {
      render(<IndexPage />);
      const button = indexButton();
      expect(button.getAttribute('aria-expanded'), 'trigger must report closed state').toBe(
        'false',
      );
      expect(button.getAttribute('aria-controls')).toBe(DRAWER_ID);
      expect(button.getAttribute('aria-haspopup')).toBe('dialog');
      expect(button.textContent).toContain(`01/${SECTION_REGISTRY.length}`);
    });

    it('opens the modal drawer, focuses the current item and returns focus on Escape', () => {
      render(<IndexPage />);
      const button = indexButton();
      fireEvent.click(button);
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(panel().getAttribute('aria-modal')).toBe('true');
      expect(
        document.activeElement?.getAttribute('aria-current'),
        'focus lands on current item',
      ).toBeTruthy();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement, 'focus must return to the INDEX trigger').toBe(button);
    });

    it('renders no rail toggle: the drawer opens only from a trigger', () => {
      render(<IndexPage />);
      expect(screen.queryByRole('button', { name: 'Open section menu' })).toBeNull();
      expect(panel().classList.contains('is-open')).toBe(false);
    });
  });
});
