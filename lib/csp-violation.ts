export const UNKNOWN = 'unknown';
export const MAX_FIELD_CHARS = 256;

const EXTENSION_SCHEME = /^\s*(?:[a-z]+-)*extension:/i;
const WEB_PROTOCOL = /^https?:$/;
const DIRECTIVE_NAME = /^[a-z][a-z0-9-]{0,63}$/;
const SOURCE_KEYWORD = /^[a-z][a-z-]{0,31}$/;
const SCHEME_SEPARATOR_LENGTH = 1;

export type CspDisposition = 'enforce' | 'report' | typeof UNKNOWN;

function parseUrl(value: string | undefined): URL | null {
  try {
    return new URL(value ?? '');
  } catch {
    return null;
  }
}

export function isExtensionSource(value: string | undefined): boolean {
  return EXTENSION_SCHEME.test(value ?? '');
}

export function blockedHost(blocked: string | undefined): string {
  const url = parseUrl(blocked);
  if (url) {
    return (url.host || url.protocol.slice(0, -SCHEME_SEPARATOR_LENGTH)).slice(0, MAX_FIELD_CHARS);
  }
  return blocked !== undefined && SOURCE_KEYWORD.test(blocked) ? blocked : UNKNOWN;
}

export function documentPath(documentUri: string | undefined): string {
  const url = parseUrl(documentUri);
  return url && WEB_PROTOCOL.test(url.protocol) ? url.pathname.slice(0, MAX_FIELD_CHARS) : UNKNOWN;
}

export function cspDirective(value: string | undefined): string {
  return value !== undefined && DIRECTIVE_NAME.test(value) ? value : UNKNOWN;
}

export function cspDisposition(value: string | undefined): CspDisposition {
  return value === 'enforce' || value === 'report' ? value : UNKNOWN;
}
