export const UNKNOWN = 'unknown';
export const MAX_FIELD_CHARS = 256;

const WEB_PROTOCOLS = ['http:', 'https:'];
const EXTENSION_SCHEME = /^(?:[a-z]+-)*extension:/i;
const DIRECTIVE_NAME = /^[a-z][a-z0-9-]{0,63}$/;
const SOURCE_KEYWORD = /^[a-z][a-z-]{0,31}$/;
const SCHEME_SUFFIX = /:$/;
const DISPOSITIONS = ['enforce', 'report'] as const;

export type CspDisposition = (typeof DISPOSITIONS)[number] | typeof UNKNOWN;

function parseUrl(value: string | undefined): URL | null {
  if (value === undefined) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function capField(value: string): string {
  return value.slice(0, MAX_FIELD_CHARS);
}

export function isExtensionSource(value: string | undefined): boolean {
  return value !== undefined && EXTENSION_SCHEME.test(value.trim());
}

export function blockedHost(blocked: string | undefined): string {
  const url = parseUrl(blocked);
  if (url) return capField(url.host || url.protocol.replace(SCHEME_SUFFIX, ''));
  return blocked !== undefined && SOURCE_KEYWORD.test(blocked) ? blocked : UNKNOWN;
}

export function documentPath(documentUri: string | undefined): string {
  const url = parseUrl(documentUri);
  return url && WEB_PROTOCOLS.includes(url.protocol) ? capField(url.pathname) : UNKNOWN;
}

export function cspDirective(value: string | undefined): string {
  return value !== undefined && DIRECTIVE_NAME.test(value) ? value : UNKNOWN;
}

export function cspDisposition(value: string | undefined): CspDisposition {
  return DISPOSITIONS.find((known) => known === value) ?? UNKNOWN;
}
