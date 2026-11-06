import { companyLinkCopy } from './company-link';
import type { ContactContent } from './contact';
import { copyFeedback } from './copy-button';
import { SITE_LOCALE, type SiteLocale } from './site-locale';
import { EMAIL_ADDRESS, LINKEDIN_URL } from './social-urls';
import { WORK_SCOPE } from './work-scope';

export const CONTACT_LIMITS = {
  nameMin: 1,
  nameMax: 120,
  messageMin: 10,
  messageMax: 2_000,
} as const;

export const CONTACT_EMAIL_PATTERN =
  /^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

export const CONTACT_FIELD = {
  NAME: 'name',
  EMAIL: 'email',
  MESSAGE: 'message',
} as const;

export type ContactField = (typeof CONTACT_FIELD)[keyof typeof CONTACT_FIELD];

export const CONTACT_DELIVERY_CODE = { QUEUED: 'queued' } as const;

export const CONTACT_ERROR_CODE = { RATE_LIMITED: 'rate_limited' } as const;

const REPLY_WINDOW: Record<SiteLocale, string> = {
  [SITE_LOCALE.en]: 'within 48h',
  [SITE_LOCALE.pt]: 'em até 48h',
};
const ERIK_PLACE = 'São Paulo';

const contactCopyFor = (locale: SiteLocale): ContactContent => {
  const pt = locale === SITE_LOCALE.pt;
  return {
    success: {
      title: pt ? 'EXECUTAR_ENVIO :: SUCESSO' : 'EXECUTE_SEND :: SUCCESS',
      message: pt
        ? 'handshake iniciado · espere resposta em até 48h'
        : 'handshake initiated · expect reply within 48h',
      receipt: {
        refLabel: 'ref',
        atLabel: pt ? 'enviado' : 'sent',
        dateLocale: pt ? 'pt-BR' : 'en-US',
        copy: pt ? '[COPIAR REF]' : '[COPY REF]',
        copied: pt ? '[REF COPIADA]' : '[REF COPIED]',
        forgetLabel: pt ? 'pedir exclusão da mensagem' : 'request deletion of this message',
        forgetSubject: pt ? 'Excluir minha mensagem, ref' : 'Delete my message, ref',
        feedback: copyFeedback[locale],
      },
    },
    queued: {
      title: pt ? 'EXECUTAR_ENVIO :: NA FILA' : 'EXECUTE_SEND :: QUEUED',
      message: pt
        ? 'salvo, ainda não entregue; a entrega é tentada de novo automaticamente; para resposta mais rápida use'
        : 'saved, not delivered yet; delivery is retried automatically; for a faster reply use',
      linkLabel: 'LinkedIn',
      linkHref: LINKEDIN_URL,
    },
    section: {
      command: 'SUDO CONTACT --INIT',
      mobileCommand: 'SUDO CONTACT',
      email: EMAIL_ADDRESS,
      linkedinHref: LINKEDIN_URL,
      copyEmail: pt ? '[COPIAR EMAIL]' : '[COPY EMAIL]',
      copyEmailCopied: pt ? '[COPIADO]' : '[COPIED]',
      loadingLabel: pt ? 'Carregando formulário de contato' : 'Loading contact form',
      noscript: pt
        ? 'O formulário de contato precisa de JavaScript. Envie um email para'
        : 'The contact form needs JavaScript. Email me at',
    },
    channels: {
      title: 'LS -L ~/CHANNELS',
      marker: '▌',
      emailLabel: 'email',
      linkedinLabel: 'linkedin',
      linkedinCta: pt ? 'MENSAGEM_NO_LINKEDIN' : 'MESSAGE_ON_LINKEDIN',
      linkedinGlyph: '↗',
      linkedinNewTabNote: companyLinkCopy[locale].disclosure,
      githubLabel: 'github',
      githubAccessibleLabel: `github.com/erikunha ${companyLinkCopy[locale].disclosure}`,
      languagesLabel: pt ? 'idioma' : 'lang',
    },
    timezone: {
      title: 'DATE --TZ ~/OVERLAP',
      marker: '▌',
      loading: pt ? 'carregando horário local…' : 'loading local time…',
      status: {
        online: pt ? 'ONLINE AGORA · deve responder hoje' : 'ONLINE NOW · likely to reply today',
        offHours: pt
          ? 'FORA DO HORÁRIO · volta em ~{hours}h, envie mesmo assim'
          : 'OFF HOURS · back in ~{hours}h, message anyway',
      },
      clocks: { erik: 'erik', you: pt ? 'você' : 'you', link: '⇄' },
      map: {
        erikPlace: ERIK_PLACE,
        erikLabel: 'erik · {code}',
        youLabel: pt ? 'você · {code}' : 'you · {code}',
        ariaLabel: pt
          ? 'Mapa mundi. Erik em {erikPlace}, você em {place}, {overlap} de horário de trabalho compartilhado.'
          : 'World map. Erik in {erikPlace}, you in {place}, {overlap} of shared working time.',
      },
      location: {
        youAre: pt ? 'Você está em' : 'You are in',
        detectedAuto: pt ? 'detectado automaticamente · {zone}' : 'auto-detected · {zone}',
        detectedManual: pt ? 'definido por você · {zone}' : 'set by you · {zone}',
      },
      search: {
        label: pt ? 'Busque sua cidade ou fuso horário' : 'Search your city or timezone',
        placeholder: pt
          ? 'não certo? busque cidade ou fuso horário…'
          : 'not right? search city or timezone…',
        listLabel: pt ? 'Fusos horários' : 'Timezones',
        count: pt
          ? '{matches} de {total} fusos · do seu navegador, sem download'
          : '{matches} of {total} timezones · from your browser, no download',
      },
      rows: { erik: 'erik', you: pt ? 'você' : 'you', both: pt ? 'ambos' : 'both' },
      axis: ['00', '06', '12', '18', '24'],
      slot: {
        title: pt ? 'melhor horário para uma chamada' : 'best slot for a call',
        you: pt ? 'você' : 'you',
        erik: 'erik',
        none: pt ? 'sem janela ao vivo, só assíncrono' : 'no live window, async only',
        separator: ' · ',
      },
      propose: {
        label: pt ? 'PROPOR_NA_MENSAGEM ↙' : 'PROPOSE_IN_MESSAGE ↙',
        added: pt ? 'adicionado à sua mensagem' : 'added to your message',
        focusLink: pt ? 'editar mensagem ↑' : 'edit message ↑',
        line: pt
          ? `Uma chamada às {you} no meu horário ({city}) funciona para você? Para você seriam {erik} em ${ERIK_PLACE}.`
          : `Would a call at {you} my time ({city}) work for you? That is {erik} for you in ${ERIK_PLACE}.`,
        sameZoneLine: pt
          ? 'Uma chamada às {you} funciona para você? Estamos no mesmo fuso horário.'
          : 'Would a call at {you} work for you? We are on the same clock.',
      },
      overlap: {
        summary: pt ? '{hours} de sobreposição' : '{hours} overlap',
        range: pt ? '{range} seu horário' : '{range} your time',
        none: pt
          ? `assíncrono funciona, resposta ${REPLY_WINDOW.pt}`
          : `async works, reply ${REPLY_WINDOW.en}`,
        separator: ' · ',
      },
      hours: {
        one: pt ? '{count} hora' : '{count} hour',
        other: pt ? '{count} horas' : '{count} hours',
      },
      facts: {
        availabilityLabel: pt ? 'início' : 'start',
        modeLabel: pt ? 'modo' : 'mode',
        modeValue: WORK_SCOPE[locale],
        relocationLabel: pt ? 'visto' : 'visa',
        relocationValue: pt
          ? 'aberto a realocação com patrocínio de visto'
          : 'open to relocation with visa sponsorship',
        engagementLabel: pt ? 'tipo' : 'type',
        engagementValue: pt ? 'tempo integral ou contrato' : 'full-time or contract',
        replyLabel: pt ? 'resposta' : 'reply',
        replyValue: REPLY_WINDOW[locale],
      },
      announce: pt
        ? 'Fuso definido para {place}. Horário local de Erik {erik}. Seu horário local {you}.'
        : 'Time zone set to {place}. Erik local time {erik}. Your local time {you}.',
    },
    form: {
      nameLabel: pt ? '$ nome:' : '$ name:',
      emailLabel: '$ email:',
      messageLabel: pt ? '$ mensagem:' : '$ message:',
      namePlaceholder: pt ? 'seu nome' : 'your name',
      emailPlaceholder: 'you@company.com',
      messagePlaceholder: pt ? '[PRONTO PARA RECEBER DADOS...]' : '[READY FOR DATA INPUT...]',
      submit: pt ? 'EXECUTAR_ENVIO' : 'EXECUTE_SEND',
      submitting: pt ? 'TRANSMITINDO...' : 'TRANSMITTING...',
      sending: pt ? 'enviando…' : 'sending…',
      waiting: pt ? 'aguardando override manual... _' : 'waiting for manual override... _',
      statusInvalid: pt ? 'corrija os campos marcados... _' : 'fix the marked fields... _',
      statusFailed: pt ? 'envio falhou, tente de novo... _' : 'send failed, retry when ready... _',
      errorPrefix: pt ? 'erro:' : 'error:',
      errorSummary: {
        one: pt ? '1 campo precisa de atenção:' : '1 field needs attention:',
        many: pt ? '{count} campos precisam de atenção:' : '{count} fields need attention:',
        separator: ' · ',
      },
      retained: pt ? 'Seu texto continua aqui.' : 'Your text is still here.',
      retryEmail: pt ? 'Tente novamente, ou envie email' : 'Retry, or email',
      counterSeparator: '/',
      privacy: pt
        ? 'Mantido por 90 dias para Erik poder responder, depois excluído. IP hasheado para rate limiting. Nunca compartilhado.'
        : 'Kept 90 days so Erik can reply, then deleted. IP hashed for rate limiting. Never shared.',
      fieldLabels: {
        name: pt ? 'nome' : 'name',
        email: 'email',
        message: pt ? 'mensagem' : 'message',
      },
    },
    errors: {
      name: pt
        ? `erro: nome é obrigatório, de ${CONTACT_LIMITS.nameMin} a ${CONTACT_LIMITS.nameMax} caracteres`
        : `error: name is required, ${CONTACT_LIMITS.nameMin} to ${CONTACT_LIMITS.nameMax} characters`,
      email: pt
        ? 'erro: email precisa de um @ e um domínio, como nome@site.com'
        : 'error: email needs an @ and a domain, like name@site.com',
      message: pt
        ? `erro: mensagem precisa de ${CONTACT_LIMITS.messageMin} a ${CONTACT_LIMITS.messageMax} caracteres`
        : `error: message needs ${CONTACT_LIMITS.messageMin} to ${CONTACT_LIMITS.messageMax} characters`,
      storageUnavailable: pt
        ? 'armazenamento indisponível, tente novamente'
        : 'storage unavailable, try again',
      retryUnavailable: pt
        ? 'nova tentativa de entrega indisponível, tente novamente ou use o LinkedIn'
        : 'delivery retry unavailable, try again or use LinkedIn',
      rateLimited: pt
        ? 'muitas requisições, tente novamente em 10 minutos'
        : 'too many requests, try again in 10 minutes',
      requestFailed: pt ? 'não foi possível enviar agora' : 'could not send right now',
    },
  };
};

export const contactCopy: Record<SiteLocale, ContactContent> = {
  [SITE_LOCALE.en]: contactCopyFor(SITE_LOCALE.en),
  [SITE_LOCALE.pt]: contactCopyFor(SITE_LOCALE.pt),
};

export function contactErrorSummary(copy: ContactContent, count: number): string {
  const { one, many } = copy.form.errorSummary;
  return count === 1 ? one : many.replace('{count}', String(count));
}

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;
const HOURS_DECIMALS = 2;
const SINGULAR_HOURS = 1;

export function fillCopy(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(PLACEHOLDER_PATTERN, (token, key: string) => {
    const value = values[key];
    return value === undefined ? token : String(value);
  });
}

export function contactHoursPhrase(
  hoursCopy: { one: string; other: string },
  hours: number,
): string {
  return fillCopy(hours === SINGULAR_HOURS ? hoursCopy.one : hoursCopy.other, {
    count: Number(hours.toFixed(HOURS_DECIMALS)),
  });
}

export function contactErrorMessage(copy: ContactContent, code: string | undefined): string {
  return code === CONTACT_ERROR_CODE.RATE_LIMITED
    ? copy.errors.rateLimited
    : copy.errors.requestFailed;
}
