import { HIRE_ACCESSIBLE_NAME, NAV_VOCABULARY } from './nav';
import { profile, profilePresentation } from './profile';
import { type HeroContent, HeroContentSchema } from './schemas';
import { localizedPath, SITE_LOCALE, type SiteLocale } from './site-locale';
import { social } from './social';

const EXTERNAL_PROTOCOL = 'https://';

const heroContentFor = (locale: SiteLocale): HeroContent => {
  const pt = locale === SITE_LOCALE.pt;
  return HeroContentSchema.parse({
    locationLabel: pt ? 'LOCAL:' : 'LOC:',
    employerLabel: pt ? 'AGORA:' : 'NOW:',
    languageLabel: pt ? 'IDIOMA:' : 'LANG:',
    statsLabel: pt ? 'Impacto em escala' : 'Impact at scale',
    hire: {
      label: NAV_VOCABULARY[locale].hire,
      href: social.linkedin,
      accessibleLabel: HIRE_ACCESSIBLE_NAME[locale],
    },
    actions: [
      ...profile.actions,
      { label: pt ? 'VER_CV' : 'VIEW_CV', href: localizedPath(locale, '/cv'), hiddenOnWide: true },
      { label: pt ? 'RESUMO_30S' : '30S_SUMMARY', href: localizedPath(locale, '/summary') },
    ].map((action) => ({
      ...action,
      accessibleLabel: action.href.startsWith(EXTERNAL_PROTOCOL)
        ? pt
          ? `${action.label}, abre em uma nova guia`
          : `${action.label}, opens in a new tab`
        : action.label,
      external: action.href.startsWith(EXTERNAL_PROTOCOL),
    })),
    stats: [
      { value: '$500B+', label: pt ? 'ativos em fundos' : 'fund assets' },
      { value: '8M+', label: pt ? 'MAU e-commerce' : 'e-com MAU' },
      { value: '40s → <1s', label: pt ? 'API de relatórios' : 'reporting API' },
      { value: 'CLS → 0', label: pt ? 'deslocamento de layout' : 'layout shift' },
    ],
  });
};

export const heroContent: Record<SiteLocale, HeroContent> = {
  [SITE_LOCALE.en]: heroContentFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: heroContentFor(SITE_LOCALE.pt),
};

export const heroTagline = (locale: SiteLocale): string => profilePresentation[locale].tagline;
