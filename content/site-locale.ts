// Site-wide locale model (DECISIONS 2026-11-04): the address alone determines
// the language. English keeps every existing address (the bare `/` included,
// because the distributed CV PDF embeds it); pt-BR is additive under `/pt`.
// This mirrors the /links reference shape (content/links.constants.ts) without
// a framework, negotiation or middleware.

export const SITE_LOCALE = { en: 'en', pt: 'pt' } as const;

export type SiteLocale = (typeof SITE_LOCALE)[keyof typeof SITE_LOCALE];

export const SITE_LOCALES: readonly SiteLocale[] = Object.values(SITE_LOCALE);

export const DEFAULT_SITE_LOCALE: SiteLocale = SITE_LOCALE.en;

export const SITE_HTML_LANG = {
  [SITE_LOCALE.en]: 'en-US',
  [SITE_LOCALE.pt]: 'pt-BR',
} as const satisfies Record<SiteLocale, string>;

export const SITE_OG_LOCALE = {
  [SITE_LOCALE.en]: 'en_US',
  [SITE_LOCALE.pt]: 'pt_BR',
} as const satisfies Record<SiteLocale, string>;

// The pt-BR variant of an internal path: the English path stays put, '/pt'
// prefixes the page path. Hash fragments ride along ('/#x' -> '/pt#x'): the
// section ids are identical in both locales, and '/pt/' would eat a trailing-
// slash redirect before the fragment resolves.
export function localizedPath(locale: SiteLocale, path: string): string {
  if (locale === SITE_LOCALE.en) return path;
  if (path === '/') return '/pt';
  if (path.startsWith('/#')) return `/pt${path.slice(1)}`;
  return `/pt${path}`;
}

export function stripLocalePrefix(pathname: string): string {
  return pathname === '/pt' ? '/' : pathname.startsWith('/pt/') ? pathname.slice(3) : pathname;
}

// Reciprocal hreflang pair for an internal page path, plus x-default. The bare
// English address is the default for languages the site does not serve. The
// canonical is the page's own address; consumers serving a specific locale
// localize it themselves (see app/_lib/locale-metadata.ts).
export function localeAlternates(path: string): {
  en: string;
  pt: string;
  languages: Record<string, string>;
} {
  const enPath = localizedPath(SITE_LOCALE.en, path);
  const ptPath = localizedPath(SITE_LOCALE.pt, path);
  return {
    en: enPath,
    pt: ptPath,
    languages: {
      'pt-BR': ptPath,
      'en-US': enPath,
      'x-default': enPath,
    },
  };
}

// The language switch renders only where both locales exist. /links keeps its
// own pair (pt at the bare address, en at /links/en) per its 2026-08-30
// decision; routes with no pt counterpart (the design system) render no
// switch.
const LANGUAGE_PAIRS: Record<string, Record<SiteLocale, string>> = {
  '/': { [SITE_LOCALE.en]: '/', [SITE_LOCALE.pt]: '/pt' },
  '/cv': { [SITE_LOCALE.en]: '/cv', [SITE_LOCALE.pt]: '/pt/cv' },
  '/summary': { [SITE_LOCALE.en]: '/summary', [SITE_LOCALE.pt]: '/pt/summary' },
  '/pt': { [SITE_LOCALE.en]: '/', [SITE_LOCALE.pt]: '/pt' },
  '/pt/cv': { [SITE_LOCALE.en]: '/cv', [SITE_LOCALE.pt]: '/pt/cv' },
  '/pt/summary': { [SITE_LOCALE.en]: '/summary', [SITE_LOCALE.pt]: '/pt/summary' },
  '/links': { [SITE_LOCALE.en]: '/links/en', [SITE_LOCALE.pt]: '/links' },
  '/links/en': { [SITE_LOCALE.en]: '/links/en', [SITE_LOCALE.pt]: '/links' },
};

export const LANGUAGE_SWITCH_NAME: Record<SiteLocale, string> = {
  [SITE_LOCALE.en]: 'English',
  [SITE_LOCALE.pt]: 'Português',
};

export function languageSwitchPaths(pathname: string): Record<SiteLocale, string> | null {
  return LANGUAGE_PAIRS[pathname] ?? null;
}
