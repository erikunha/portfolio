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

export function localizedPath(locale: SiteLocale, path: string): string {
  if (locale === SITE_LOCALE.en) return path;
  if (path === '/') return '/pt';
  if (path.startsWith('/#')) return `/pt${path.slice(1)}`;
  return `/pt${path}`;
}

const PT_PREFIX = '/pt';

export function localeOfPath(pathname: string | null): SiteLocale {
  if (pathname === PT_PREFIX || pathname?.startsWith(`${PT_PREFIX}/`)) return SITE_LOCALE.pt;
  return SITE_LOCALE.en;
}

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

const PAGE_OWNED_LANGUAGE_SWITCH = new Set(['/links', '/links/en']);

export function headerLanguageSwitchPaths(pathname: string): Record<SiteLocale, string> | null {
  return PAGE_OWNED_LANGUAGE_SWITCH.has(pathname) ? null : languageSwitchPaths(pathname);
}

const HOME_PATHS: ReadonlySet<string> = new Set(['/', PT_PREFIX]);

export function withSectionHash(
  pathname: string,
  paths: Record<SiteLocale, string>,
  sectionId: string | null,
): Record<SiteLocale, string> {
  if (!sectionId || !HOME_PATHS.has(pathname)) return paths;
  return {
    [SITE_LOCALE.en]: `${paths[SITE_LOCALE.en]}#${sectionId}`,
    [SITE_LOCALE.pt]: `${paths[SITE_LOCALE.pt]}#${sectionId}`,
  };
}

export function languageSwitchPaths(pathname: string): Record<SiteLocale, string> | null {
  return LANGUAGE_PAIRS[pathname] ?? null;
}
