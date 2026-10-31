import { CV_LINK_LABEL, READING_PATHS } from './reading-paths';
import { LINKEDIN_URL } from './social-urls';

export type TopbarNavLink = {
  label: string;
  href: string;
};

export const NAV_VOCABULARY = {
  about: 'ABOUT',
  work: 'WORK',
  career: 'CAREER',
  contact: 'CONTACT',
  designSystem: 'DESIGN_SYSTEM',
  summary: '30S_SUMMARY',
  hire: 'HIRE_ON_LINKEDIN',
  linkedin: 'LinkedIn',
} as const;

export const TOPBAR_NAV: readonly TopbarNavLink[] = [
  { label: NAV_VOCABULARY.about, href: '/#sec-readme' },
  { label: NAV_VOCABULARY.work, href: '/#sec-projects' },
  { label: NAV_VOCABULARY.career, href: '/#sec-git-log' },
  { label: NAV_VOCABULARY.contact, href: '/#sec-contact' },
  { label: NAV_VOCABULARY.designSystem, href: '/design-system' },
];

export const TOPBAR_READING_LINK = { label: CV_LINK_LABEL, href: READING_PATHS.cv } as const;

export const TOPBAR_MOTION_LABEL = 'MOTION';

export const TOPBAR_HIRE_LINK = {
  label: NAV_VOCABULARY.hire,
  href: LINKEDIN_URL,
} as const;
