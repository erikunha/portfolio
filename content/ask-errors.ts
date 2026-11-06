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
  truncation: string;
  forbiddenOrigin: string;
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
    truncation: pt
      ? `\n\n[resposta truncada: esta resposta atingiu o limite de tamanho. Escreva para ${social.email} para a resposta completa.]`
      : `\n\n[answer truncated: this response hit its length limit. Email ${social.email} for the full answer.]`,
    forbiddenOrigin: pt
      ? 'pedido recusado: pergunte pela própria página do site'
      : 'request refused: ask from the site itself',
  };
};

export const askErrors: Record<SiteLocale, AskErrors> = {
  [SITE_LOCALE.en]: askErrorsFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: askErrorsFor(SITE_LOCALE.pt),
};
