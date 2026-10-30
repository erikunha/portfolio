export function collectTsx(dir: string): string[];
export function collectRenderedSectionIds(sources: string[]): Set<string>;
export function collectLiveSectionIds(sources: string[]): Set<string>;
export function collectOrderedIds(css: string): Set<string>;
export function collectCssSectionIds(css: string): Set<string>;
export function findMissingOrderEntries(
  renderedIds: Set<string>,
  orderedIds: Set<string>,
  knownUnordered?: Set<string>,
): string[];
export function findOrphanedCssIds(cssIds: Set<string>, liveIds: Set<string>): string[];
