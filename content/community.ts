import { companyLinkCopy } from './company-link';
import { type CommunityEvent, CommunityEventSchema } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

const communityEventFor = (locale: SiteLocale): CommunityEvent => {
  const pt = locale === SITE_LOCALE.pt;
  return CommunityEventSchema.parse({
    name: 'DEVOPSDAYS_CAMPINAS',
    year: 2024,
    role: pt ? 'ORGANIZADOR' : 'ORGANIZER',
    bullets: [
      pt
        ? 'selecionou 8 palestras sobre DevOps, infraestrutura de nuvem, engenharia de plataforma e arquitetura.'
        : 'curated 8 talks across DevOps, cloud infrastructure, platform engineering and architecture.',
      pt
        ? 'conduziu o ciclo completo de palestrantes: abertura do CFP → revisão → seleção → desenho do programa → dia do evento → encerramento.'
        : 'ran the full speaker cycle: CFP launch → review → selection → program design → day-of → wrap.',
      pt
        ? 'coordenou palestrantes, patrocinadores e co-organizadores de ponta a ponta, e publicou palestrantes, programação e patrocinadores no site open source em 4 pull requests mergeados.'
        : 'coordinated with speakers, sponsors, and co-organizers end-to-end, and published speakers, schedule and sponsors to the open-source site in 4 merged pull requests.',
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

export const communityTalksSentence = communityEvent[SITE_LOCALE.en].bullets[0] ?? '';
