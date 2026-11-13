import { SITE_LOCALE, type SiteLocale } from './site-locale';

// The roles Erik is open to. One list, two languages, and every surface
// derived from it: the About panel, the ask prompt, the hiring profile served
// at /api/erik.json and the documentation read from here, so the list cannot
// change on one surface while another still names the old one.
//
// The list is a SET of targets, not a single title: the site's title ("Senior
// Software Engineer, AI Engineer") states the role Erik holds, and these are
// the roles he would take. The two are different facts and both are published.
export const OPEN_ROLES: Record<SiteLocale, readonly string[]> = {
  [SITE_LOCALE.en]: [
    'Senior',
    'AI Engineer',
    'Applied AI Engineer',
    'AI Product Engineer',
    'Founding Engineer',
  ],
  [SITE_LOCALE.pt]: [
    'Sênior',
    'Engenheiro de IA',
    'Engenheiro de IA Aplicada',
    'Engenheiro de Produto de IA',
    'Engenheiro Fundador',
  ],
};

// The machine-readable slugs the hiring profile publishes. They are not
// derived from the display names: a display name can be reworded for a
// language and the token stays stable, which is what a consumer parses.
export const OPEN_ROLE_TOKENS = [
  'senior',
  'ai_engineer',
  'applied_ai_engineer',
  'ai_product_engineer',
  'founding_engineer',
] as const;

const CONJUNCTION: Record<SiteLocale, string> = {
  [SITE_LOCALE.en]: 'and',
  [SITE_LOCALE.pt]: 'e',
};

const joinRoles = (roles: readonly string[], conjunction: string): string => {
  if (roles.length === 0) return '';
  if (roles.length === 1) return roles[0] as string;
  return `${roles.slice(0, -1).join(', ')} ${conjunction} ${roles[roles.length - 1] as string}`;
};

// "Senior, AI Engineer, Applied AI Engineer, AI Product Engineer and Founding
// Engineer", the form a sentence needs, so no surface hand-writes the list
// and no two surfaces punctuate it differently.
export const OPEN_ROLES_SENTENCE: Record<SiteLocale, string> = {
  [SITE_LOCALE.en]: joinRoles(OPEN_ROLES[SITE_LOCALE.en], CONJUNCTION[SITE_LOCALE.en]),
  [SITE_LOCALE.pt]: joinRoles(OPEN_ROLES[SITE_LOCALE.pt], CONJUNCTION[SITE_LOCALE.pt]),
};
