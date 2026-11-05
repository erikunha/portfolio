import { type CommunityEvent, CommunityEventSchema } from './schemas';
import { SITE_LOCALE, type SiteLocale } from './site-locale';

// The English copy is canonical: the identity gate holds the JSON-LD and
// llms.txt to these sentences, and the ask prompt cites them. pt-BR is the
// rendered variant for the locale routes.
const communityEventFor = (locale: SiteLocale): CommunityEvent => {
  const pt = locale === SITE_LOCALE.pt;
  return CommunityEventSchema.parse({
    name: 'DEVOPSDAYS_CAMPINAS',
    year: 2024,
    role: pt ? 'ORGANIZADOR' : 'ORGANIZER',
    bullets: [
      pt
        ? 'selecionou mais de 10 palestras cobrindo DevOps, infra de nuvem, engenharia de plataforma e arquitetura.'
        : 'curated 10+ talks across DevOps, cloud infra, platform engineering, and architecture.',
      pt
        ? 'conduziu o ciclo completo de palestrantes: abertura do CFP → revisão → seleção → desenho do programa → dia do evento → encerramento.'
        : 'ran the full speaker cycle: CFP launch → review → selection → program design → day-of → wrap.',
      pt
        ? 'coordenou palestrantes, patrocinadores e co-organizadores de ponta a ponta.'
        : 'coordinated with speakers, sponsors, and co-organizers end-to-end.',
    ],
    link: {
      label: 'devopsdays.org',
      href: 'https://devopsdays.org/events/2024-campinas/welcome/',
    },
    newTabLabel: pt ? '(abre em uma nova guia)' : '(opens in a new tab)',
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
