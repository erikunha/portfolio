import { companyLinkCopy } from './company-link';
import { type CommunityEvent, CommunityEventSchema } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

const communityEventFor = (locale: SiteLocale): CommunityEvent => {
  const pt = locale === SITE_LOCALE.pt;
  return CommunityEventSchema.parse({
    name: 'DEVOPSDAYS_CAMPINAS',
    year: 2024,
    role: pt ? 'COORGANIZADOR' : 'CO-ORGANIZER',
    bullets: [
      pt
        ? 'Conduziu o call for papers, encontrou palestrantes e coordenou com patrocinadores, selecionando 8 palestras sobre DevOps, nuvem, engenharia de plataforma e arquitetura.'
        : 'Ran the call for papers, found speakers and coordinated with sponsors, curating 8 talks across DevOps, cloud, platform engineering and architecture.',
    ],
    link: {
      label: 'devopsdays.org',
      href: 'https://devopsdays.org/events/2024-campinas/welcome/',
    },
    newTabLabel: companyLinkCopy[locale].disclosure,
    statusLine: pt
      ? 'aberto a submissões de CFP para 2027 · aberto a voluntariado / organização.'
      : 'open to CFP submissions for 2027 · open to volunteer / organizer roles.',
  });
};

export const communityEvent: Record<SiteLocale, CommunityEvent> = {
  [SITE_LOCALE.en]: communityEventFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: communityEventFor(SITE_LOCALE.pt),
};

export const communityRoleSentence = communityEvent[SITE_LOCALE.en].bullets[0] ?? '';
