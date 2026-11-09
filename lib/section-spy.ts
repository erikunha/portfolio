import { observeInView, supportsInView } from './in-view';

export const HOME_SECTION_ID = 'bio';
export const MOBILE_HERO_SELECTOR = '[data-testid="hero-mobile"]';
export const NO_SECTION_ID = '';

const release = () => undefined;

export function resolveSections(ids: readonly string[]): Map<Element, string> {
  const sections = new Map<Element, string>();
  for (const id of ids) {
    const element = document.getElementById(id);
    if (element) sections.set(element, id);
  }
  const mobileHero = document.querySelector(MOBILE_HERO_SELECTOR);
  if (mobileHero) sections.set(mobileHero, HOME_SECTION_ID);
  return sections;
}

function byDocumentOrder(a: Element, b: Element): number {
  if (a === b) return 0;
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1;
}

export function observeSections(
  ids: readonly string[],
  { rootMargin }: { rootMargin: string },
  onEnter: (entered: readonly string[]) => void,
): () => void {
  if (!supportsInView()) return release;
  const sections = resolveSections(ids);
  if (sections.size === 0) {
    onEnter([NO_SECTION_ID]);
    return release;
  }
  return observeInView(
    [...sections.keys()],
    (entries) => {
      const entered = new Set<string>();
      const targets = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target)
        .sort(byDocumentOrder);
      for (const target of targets) {
        const id = sections.get(target);
        if (id !== undefined) entered.add(id);
      }
      if (entered.size > 0) onEnter([...entered]);
    },
    { rootMargin },
  );
}
