import { SITE_LOCALE, type SiteLocale } from './site-locale';
import { social } from './social';

export type AskErrors = {
  unavailable: string;
  rateLimited: string;
  questionRequired: string;
  invalidBody: string;
  injection: string;
  duplicate: string;
  budget: string;
  budgetDaily: string;
  truncation: string;
  forbiddenOrigin: string;
  interrupted: string;
};

const askErrorsFor = (locale: SiteLocale): AskErrors => {
  const pt = locale === SITE_LOCALE.pt;
  return {
    unavailable: pt
      ? `temporariamente indisponível: escreva para ${social.email}`
      : `temporarily unavailable: email ${social.email} directly`,
    rateLimited: pt
      ? 'limite de perguntas atingido: tente de novo em uma hora'
      : 'rate limit exceeded: try again in an hour',
    questionRequired: pt ? 'a pergunta é obrigatória' : 'question is required',
    invalidBody: pt ? 'corpo da requisição inválido' : 'invalid request body',
    injection: pt
      ? 'pergunta rejeitada: reformule sem tokens de papel ou padrões de override de instruções'
      : 'question rejected: try rephrasing without role tokens or instruction-override patterns',
    duplicate: pt
      ? 'pergunta idêntica: espere 60 segundos antes de perguntar de novo'
      : 'identical question: wait 60 seconds before asking again',
    budget: pt
      ? `As respostas de IA estão pausadas neste mês. Escreva para ${social.email}.`
      : `AI answers are paused for this month. Email ${social.email} instead.`,
    budgetDaily: pt
      ? `As respostas de IA de hoje acabaram e voltam às 00:00 UTC. Tente de novo amanhã ou escreva para ${social.email}.`
      : `Today's AI answers are used up and reset at 00:00 UTC. Try again tomorrow or email ${social.email}.`,
    truncation: pt
      ? `\n\n[resposta truncada: esta resposta atingiu o limite de tamanho. Escreva para ${social.email} para a resposta completa.]`
      : `\n\n[answer truncated: this response hit its length limit. Email ${social.email} for the full answer.]`,
    forbiddenOrigin: pt
      ? 'pedido recusado: pergunte pela própria página do site'
      : 'request refused: ask from the site itself',
    interrupted: pt
      ? `a resposta foi interrompida: pergunte de novo em instantes ou escreva para ${social.email}`
      : `the answer was interrupted: ask again in a moment or email ${social.email}`,
  };
};

export const askErrors: Record<SiteLocale, AskErrors> = {
  [SITE_LOCALE.en]: askErrorsFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: askErrorsFor(SITE_LOCALE.pt),
};
