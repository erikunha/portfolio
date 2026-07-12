export const MODULE_HEADER_ID_SUFFIX = 'header';

export type ModuleVariant = 'green';

export function moduleHeaderId(id: string): string {
  return `${id}-${MODULE_HEADER_ID_SUFFIX}`;
}
