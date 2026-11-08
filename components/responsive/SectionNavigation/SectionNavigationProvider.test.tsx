import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { siteNavChrome } from '@/content/navigation';
import { SECTION_REGISTRY } from '@/content/section-registry';
import { SITE_LOCALE } from '@/content/site-locale';
import { HOME_SECTION_ID, MOBILE_HERO_SELECTOR } from '@/lib/section-spy';
import {
  SectionNavigationProvider,
  useSectionNavigation,
} from './SectionNavigationProvider.client';

const LOCALE = SITE_LOCALE.en;
const BAND = '-45% 0px -54% 0px';
const PROJECTS = 'sec-projects';
const CONTACT = 'sec-contact';

class FakeObserver {
  static instances: FakeObserver[] = [];
  observed = new Set<Element>();
  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
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

const contexts: ReturnType<typeof useSectionNavigation>[] = [];

function Probe() {
  contexts.push(useSectionNavigation());
  return null;
}

function Page({ withHome = true, withSections = true }) {
  return (
    <SectionNavigationProvider chrome={siteNavChrome(LOCALE)} locale={LOCALE}>
      <Probe />
      <main id="main-content" tabIndex={-1}>
        {withSections
          ? SECTION_REGISTRY.filter(({ id }) => withHome || id !== HOME_SECTION_ID).map(
              ({ id }) => <section key={id} id={id} tabIndex={-1} />,
            )
          : null}
        {withSections && !withHome ? <section data-testid="hero-mobile" tabIndex={-1} /> : null}
      </main>
    </SectionNavigationProvider>
  );
}

const store = () => (contexts.at(-1) as ReturnType<typeof useSectionNavigation>).store;
const section = (id: string) => document.getElementById(id);

describe('SectionNavigationProvider', () => {
  beforeEach(() => {
    contexts.length = 0;
    FakeObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.body.dataset.motion;
  });

  it('keeps the same context object when only the current section changes', () => {
    render(<Page />);
    const before = contexts.at(-1);
    report([section(PROJECTS), true]);
    expect(store().get().currentId, 'the spy updated the store').toBe(PROJECTS);
    expect(
      new Set(contexts).size,
      'a context value that changes above an unhydrated island forces it to client-render; the current section belongs in the store',
    ).toBe(1);
    expect(contexts.at(-1)).toBe(before);
  });

  it('writes only the current section to the store, through store.set', () => {
    render(<Page />);
    const set = vi.spyOn(store(), 'set');
    report([section(PROJECTS), true]);
    report([section(CONTACT), true]);
    expect(set.mock.calls).toEqual([[{ currentId: PROJECTS }], [{ currentId: CONTACT }]]);
  });

  it('observes the reading line band with one observer over every registry section', () => {
    render(<Page />);
    expect(FakeObserver.instances).toHaveLength(1);
    expect(FakeObserver.instances[0]?.options?.rootMargin).toBe(BAND);
    expect(FakeObserver.instances[0]?.observed.size).toBe(SECTION_REGISTRY.length);
  });

  it('starts on Home and picks the earliest intersecting section in document order', () => {
    render(<Page />);
    expect(store().get().currentId).toBe(HOME_SECTION_ID);
    report([section(CONTACT), true], [section(PROJECTS), true]);
    expect(store().get().currentId).toBe(PROJECTS);
  });

  it('keeps the last current section when nothing intersects', () => {
    render(<Page />);
    report([section(PROJECTS), true]);
    report([section(PROJECTS), false]);
    expect(store().get().currentId).toBe(PROJECTS);
  });

  it('maps the mobile hero to Home', () => {
    render(<Page withHome={false} />);
    report([section(CONTACT), true]);
    report([document.querySelector(MOBILE_HERO_SELECTOR), true]);
    expect(store().get().currentId).toBe(HOME_SECTION_ID);
  });

  it('clears the current section when the page holds none of the registry sections', () => {
    render(<Page withSections={false} />);
    expect(store().get().currentId).toBe('');
  });

  it('disconnects the observer on unmount', () => {
    const view = render(<Page />);
    const observer = FakeObserver.instances[0];
    view.unmount();
    expect(observer?.observed.size).toBe(0);
  });

  it('renders without IntersectionObserver and stays on Home', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Page />);
    expect(store().get().currentId).toBe(HOME_SECTION_ID);
  });

  it('refuses a consumer outside the provider', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/inside <SectionNavigationProvider>/);
    error.mockRestore();
  });
});
