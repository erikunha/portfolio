const WWW_PREFIX = /^www\./;
const TRAILING_SLASHES = /\/+$/;

export function hostLabel(href: string): string {
  try {
    const { hostname, pathname } = new URL(href);
    return `${hostname.replace(WWW_PREFIX, '')}${pathname.replace(TRAILING_SLASHES, '')}`;
  } catch {
    return href;
  }
}
