export const MODULE_HEADER_ID_SUFFIX = 'header';

export const DEFERRED_SECTION_COUNT = 14;

export type ModuleVariant = 'green';

export function moduleHeaderId(id: string): string {
  return `${id}-${MODULE_HEADER_ID_SUFFIX}`;
}
