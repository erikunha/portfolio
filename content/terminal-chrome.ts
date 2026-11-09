import type { TerminalChrome } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

export const shellChrome: Record<SiteLocale, TerminalChrome> = {
  [SITE_LOCALE.en]: {
    promptLabel: 'erik@portfolio · /bin/sh',
    rightTag: 'SESSION_ID: 0xDEADBEEF',
    mobileLabel: 'ZSH',
  },
  [SITE_LOCALE.pt]: {
    promptLabel: 'erik@portfolio · /bin/sh',
    rightTag: 'SESSION_ID: 0xDEADBEEF',
    mobileLabel: 'ZSH',
  },
};

export const contactChrome: Record<SiteLocale, TerminalChrome> = {
  [SITE_LOCALE.en]: {
    promptLabel: 'erik@portfolio · contact',
    rightTag: 'SECURE_CHANNEL',
  },
  [SITE_LOCALE.pt]: {
    promptLabel: 'erik@portfolio · contact',
    rightTag: 'SECURE_CHANNEL',
  },
};

export const EXTERNAL_LINK_GLYPH = '↗';
