export const PREVIEW_SOURCE_LABEL = 'SOURCE';
export const PREVIEW_SOURCE_ARIA_LABEL_FALLBACK = 'Component source code';

export function previewSourceAriaLabel(id?: string): string {
  return id ? `${id} source code` : PREVIEW_SOURCE_ARIA_LABEL_FALLBACK;
}
