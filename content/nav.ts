import { companyLinkCopy } from './company-link';
import { LINKS_PATH } from './links.constants';
import { CV_LINK_LABEL, READING_PATHS } from './reading-paths';
import { SECTION_ID, sectionPath } from './section-registry';
import { localizedPath, SITE_LOCALE, type SiteLocale } from './site-locale';
import { LINKEDIN_URL } from './social-urls';

export type TopbarNavLink = {
  label: string;
  href: string;
};

export const NAV_VOCABULARY: Record<
  SiteLocale,
  {
    about: string;
    work: string;
    career: string;
    contact: string;
    designSystem: string;
    summary: string;
    links: string;
    hire: string;
    linkedin: string;
  }
> = {
  [SITE_LOCALE.en]: {
    about: 'ABOUT',
    work: 'WORK',
    career: 'CAREER',
    contact: 'CONTACT',
    designSystem: 'DESIGN_SYSTEM',
    summary: '30S_SUMMARY',
    links: 'LINKS',
    hire: 'HIRE_ON_LINKEDIN ↗',
    linkedin: 'LinkedIn',
  },
  [SITE_LOCALE.pt]: {
    about: 'SOBRE',
    work: 'PROJETOS',
    career: 'CARREIRA',
    contact: 'CONTATO',
    designSystem: 'DESIGN_SYSTEM',
    summary: 'RESUMO_30S',
    links: 'LINKS',
    hire: 'CONTRATE_NO_LINKEDIN ↗',
    linkedin: 'LinkedIn',
  },
};

export const HIRE_SHORT_LABEL: Record<SiteLocale, string> = {
  [SITE_LOCALE.en]: 'HIRE ↗',
  [SITE_LOCALE.pt]: 'CONTRATE ↗',
};

export const DOCK_HIRE_LABEL: Record<SiteLocale, string> = {
  [SITE_LOCALE.en]: 'HIRE',
  [SITE_LOCALE.pt]: 'CONTRATE',
};

export const HIRE_ACCESSIBLE_NAME: Record<SiteLocale, string> = {
  [SITE_LOCALE.en]: `Hire on LinkedIn ${companyLinkCopy[SITE_LOCALE.en].disclosure}`,
  [SITE_LOCALE.pt]: `Contrate no LinkedIn ${companyLinkCopy[SITE_LOCALE.pt].disclosure}`,
};

const topbarNav = (locale: SiteLocale): readonly TopbarNavLink[] => [
  { label: NAV_VOCABULARY[locale].about, href: sectionPath(locale, SECTION_ID.about) },
  { label: NAV_VOCABULARY[locale].work, href: sectionPath(locale, SECTION_ID.projects) },
  { label: NAV_VOCABULARY[locale].career, href: sectionPath(locale, SECTION_ID.career) },
  { label: NAV_VOCABULARY[locale].contact, href: sectionPath(locale, SECTION_ID.contact) },
  { label: NAV_VOCABULARY[locale].links, href: LINKS_PATH[locale] },
  { label: NAV_VOCABULARY[locale].designSystem, href: '/design-system' },
];

export const TOPBAR_NAV: Record<SiteLocale, readonly TopbarNavLink[]> = {
  [SITE_LOCALE.en]: topbarNav(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: topbarNav(SITE_LOCALE.pt),
};

export const TOPBAR_READING_LINK: Record<SiteLocale, TopbarNavLink> = {
  [SITE_LOCALE.en]: { label: CV_LINK_LABEL[SITE_LOCALE.en], href: READING_PATHS.cv },
  [SITE_LOCALE.pt]: {
    label: CV_LINK_LABEL[SITE_LOCALE.pt],
    href: localizedPath(SITE_LOCALE.pt, READING_PATHS.cv),
  },
};

export const TOPBAR_MOTION_LABEL = 'MOTION';

export const TOPBAR_HIRE_LINK = (
  locale: SiteLocale,
): TopbarNavLink & { accessibleName: string } => ({
  label: HIRE_SHORT_LABEL[locale],
  href: LINKEDIN_URL,
  accessibleName: HIRE_ACCESSIBLE_NAME[locale],
});
