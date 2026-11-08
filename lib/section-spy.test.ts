import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SECTION_ID } from '@/content/section-registry';
import {
  HOME_SECTION_ID,
  MOBILE_HERO_SELECTOR,
  NO_SECTION_ID,
  observeSections,
  resolveSections,
} from './section-spy';

type Callback = (entries: Array<{ target: Element; isIntersecting: boolean }>) => void;

let observers: FakeIntersectionObserver[] = [];

class FakeIntersectionObserver {
  disconnected = false;
  observed: Element[] = [];

  constructor(
    readonly callback: Callback,
    readonly options?: IntersectionObserverInit,
  ) {
    observers.push(this);
  }
  observe(target: Element) {
    this.observed.push(target);
  }
  disconnect() {
    this.disconnected = true;
  }
}

const observer = () => observers[0] as FakeIntersectionObserver;

function mountPage(ids: string[], withHero = false) {
  document.body.innerHTML = '';
  const elements = new Map<string, Element>();
  for (const id of ids) {
    const section = document.createElement('section');
    section.id = id;
    document.body.append(section);
    elements.set(id, section);
  }
  if (withHero) {
    const hero = document.createElement('section');
    hero.setAttribute('data-testid', 'hero-mobile');
    document.body.append(hero);
    elements.set('hero', hero);
  }
  return elements;
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('section ids', () => {
  it('keeps the home id in step with the section registry', () => {
    expect(HOME_SECTION_ID).toBe(SECTION_ID.home);
  });

  it('selects the mobile hero by its test id', () => {
    const elements = mountPage([], true);

    expect(document.querySelector(MOBILE_HERO_SELECTOR)).toBe(elements.get('hero'));
  });
});

describe('resolveSections', () => {
  it('maps present sections to their ids, skips absent ones and maps the mobile hero to home', () => {
    const elements = mountPage(['sec-a', 'sec-b'], true);

    const sections = resolveSections(['sec-a', 'missing', 'sec-b']);

    expect([...sections]).toEqual([
      [elements.get('sec-a'), 'sec-a'],
      [elements.get('sec-b'), 'sec-b'],
      [elements.get('hero'), HOME_SECTION_ID],
    ]);
  });
});

describe('observeSections', () => {
  it('observes each resolved section with the caller band', () => {
    const elements = mountPage(['sec-a', 'sec-b'], true);

    observeSections(['sec-a', 'sec-b'], { rootMargin: '-40% 0px -40% 0px' }, vi.fn());

    expect(observer().options).toEqual({ rootMargin: '-40% 0px -40% 0px' });
    expect(observer().observed).toEqual([
      elements.get('sec-a'),
      elements.get('sec-b'),
      elements.get('hero'),
    ]);
  });

  it('reports the intersecting sections of a batch in document order, first one leading', () => {
    const elements = mountPage(['sec-a', 'sec-b', 'sec-c']);
    const onEnter = vi.fn();
    observeSections(['sec-a', 'sec-b', 'sec-c'], { rootMargin: '0px' }, onEnter);

    observer().callback([
      { target: elements.get('sec-c') as Element, isIntersecting: true },
      { target: elements.get('sec-a') as Element, isIntersecting: false },
      { target: elements.get('sec-b') as Element, isIntersecting: true },
    ]);

    expect(onEnter).toHaveBeenCalledOnce();
    expect(onEnter).toHaveBeenCalledWith(['sec-b', 'sec-c']);
  });

  it('reports the mobile hero as home once, even when the home section intersects too', () => {
    const elements = mountPage([HOME_SECTION_ID, 'sec-a'], true);
    const onEnter = vi.fn();
    observeSections([HOME_SECTION_ID, 'sec-a'], { rootMargin: '0px' }, onEnter);

    observer().callback([
      { target: elements.get('hero') as Element, isIntersecting: true },
      { target: elements.get(HOME_SECTION_ID) as Element, isIntersecting: true },
    ]);

    expect(onEnter).toHaveBeenCalledWith([HOME_SECTION_ID]);
  });

  it('stays silent for a batch where nothing intersects', () => {
    const elements = mountPage(['sec-a']);
    const onEnter = vi.fn();
    observeSections(['sec-a'], { rootMargin: '0px' }, onEnter);

    observer().callback([{ target: elements.get('sec-a') as Element, isIntersecting: false }]);

    expect(onEnter).not.toHaveBeenCalled();
  });

  it('reports the empty id when no section is on the page and observes nothing', () => {
    mountPage([]);
    const onEnter = vi.fn();

    observeSections(['sec-a'], { rootMargin: '0px' }, onEnter);

    expect(onEnter).toHaveBeenCalledOnce();
    expect(onEnter).toHaveBeenCalledWith([NO_SECTION_ID]);
    expect(observers).toHaveLength(0);
  });

  it('reports nothing at all without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    mountPage([]);
    const onEnter = vi.fn();

    const cleanup = observeSections(['sec-a'], { rootMargin: '0px' }, onEnter);
    cleanup();

    expect(onEnter).not.toHaveBeenCalled();
  });

  it('disconnects when the returned cleanup runs', () => {
    mountPage(['sec-a']);

    const cleanup = observeSections(['sec-a'], { rootMargin: '0px' }, vi.fn());
    cleanup();

    expect(observer().disconnected).toBe(true);
  });
});
