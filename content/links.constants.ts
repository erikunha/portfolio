export const LINKS_LOCALE = { pt: 'pt', en: 'en' } as const;

export type LinksLocale = (typeof LINKS_LOCALE)[keyof typeof LINKS_LOCALE];

export const LINKS_LOCALES: readonly LinksLocale[] = Object.values(LINKS_LOCALE);

export const DEFAULT_LINKS_LOCALE: LinksLocale = LINKS_LOCALE.pt;

export const LINKS_PATH = {
  [LINKS_LOCALE.pt]: '/links',
  [LINKS_LOCALE.en]: '/links/en',
} as const satisfies Record<LinksLocale, string>;

export const LINKS_HTML_LANG = {
  [LINKS_LOCALE.pt]: 'pt-BR',
  [LINKS_LOCALE.en]: 'en-US',
} as const satisfies Record<LinksLocale, string>;

export const LINKS_OG_LOCALE = {
  [LINKS_LOCALE.pt]: 'pt_BR',
  [LINKS_LOCALE.en]: 'en_US',
} as const satisfies Record<LinksLocale, string>;

export const LINKS_INTL_LOCALE = {
  [LINKS_LOCALE.pt]: 'pt-BR',
  [LINKS_LOCALE.en]: 'en-US',
} as const satisfies Record<LinksLocale, string>;

export const PLAYLIST_ACCENT = { ai: 'quaternary', career: 'quinary' } as const;

export type PlaylistAccent = (typeof PLAYLIST_ACCENT)[keyof typeof PLAYLIST_ACCENT];

export const PILL_ICON = {
  portfolio: 'portfolio',
  github: 'github',
  linkedin: 'linkedin',
  instagram: 'instagram',
  tiktok: 'tiktok',
  email: 'email',
} as const;

export type PillIcon = (typeof PILL_ICON)[keyof typeof PILL_ICON];

export const UTM_SOURCE = 'bio';
export const UTM_SOURCE_PARAM = 'utm_source';
export const UTM_CONTENT_PARAM = 'utm_content';
