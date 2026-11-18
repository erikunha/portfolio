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

export const HREFLANG_X_DEFAULT = 'x-default';

export function localeAlternates(
  path: string,
  defaultLocale: SiteLocale = DEFAULT_SITE_LOCALE,
): {
  en: string;
  pt: string;
  languages: Record<string, string>;
} {
  const pair = languageSwitchPaths(path);
  const enPath = pair?.[SITE_LOCALE.en] ?? localizedPath(SITE_LOCALE.en, path);
  const ptPath = pair?.[SITE_LOCALE.pt] ?? localizedPath(SITE_LOCALE.pt, path);
  const byLocale = { [SITE_LOCALE.en]: enPath, [SITE_LOCALE.pt]: ptPath };
  return {
    en: enPath,
    pt: ptPath,
    languages: {
      [SITE_HTML_LANG[SITE_LOCALE.pt]]: ptPath,
      [SITE_HTML_LANG[SITE_LOCALE.en]]: enPath,
      [HREFLANG_X_DEFAULT]: byLocale[defaultLocale],
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

export const LOCALE_HOME_PATH: Record<SiteLocale, string> = {
  [SITE_LOCALE.en]: '/',
  [SITE_LOCALE.pt]: PT_PREFIX,
};

export function headerLanguageSwitchPaths(pathname: string): Record<SiteLocale, string> {
  const pair = languageSwitchPaths(pathname);
  if (pair) return pair;
  return { ...LOCALE_HOME_PATH, [localeOfPath(pathname)]: pathname };
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
