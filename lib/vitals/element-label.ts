export interface ElementLabel {
  tag?: string;
  landmark?: string;
}

const COMPOUND_SEPARATOR = '>';
const TAG_PATTERN = /^[a-z][a-z0-9]{0,15}/;
const ID_PATTERN = /#([A-Za-z0-9_-]{1,40})/;
const MAX_SELECTOR_CHARS = 400;

export function elementLabel(selector: string | undefined): ElementLabel {
  if (!selector) return {};
  const bounded = selector.slice(0, MAX_SELECTOR_CHARS);
  const compounds = bounded.split(COMPOUND_SEPARATOR).filter((part) => part.trim() !== '');
  const leaf = compounds.pop()?.trim().toLowerCase() ?? '';
  const tag = TAG_PATTERN.exec(leaf)?.[0];
  const landmark = ID_PATTERN.exec(bounded)?.[1];
  return {
    ...(tag === undefined ? {} : { tag }),
    ...(landmark === undefined ? {} : { landmark }),
  };
}
