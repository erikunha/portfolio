import { companyLinkCopy } from './company-link';
import type { ContactContent } from './contact';
import { SITE_LOCALE, type SiteLocale } from './site-locale';
import { EMAIL_ADDRESS, LINKEDIN_URL } from './social-urls';
import { WORK_SCOPE } from './work-scope';

const REPLY_WINDOW: Record<SiteLocale, string> = {
  [SITE_LOCALE.en]: 'within 48h',
  [SITE_LOCALE.pt]: 'em até 48h',
};
const RETRY_ATTEMPTS = 3;
const ERIK_PLACE = 'São Paulo';

const contactCopyFor = (locale: SiteLocale): ContactContent => {
  const pt = locale === SITE_LOCALE.pt;
  return {
    success: {
      title: pt ? '✓ mensagem entregue' : '✓ message delivered',
      message: pt ? `Resposta ${REPLY_WINDOW[locale]}.` : `Reply ${REPLY_WINDOW[locale]}.`,
      receipt: {
        atLabel: pt ? 'em' : 'at',
        dateLocale: pt ? 'pt-BR' : 'en-CA',
      },
    },
    queued: {
      title: pt ? '~ salvo, entrega pendente' : '~ saved, delivery pending',
      message: pt
        ? `Sua mensagem foi salva. A entrega por email falhou e é tentada de novo uma vez por dia, até ${RETRY_ATTEMPTS} vezes.`
        : `Your message is stored. Email delivery failed and is retried once a day, up to ${RETRY_ATTEMPTS} times.`,
      fasterLabel: pt ? 'Mais rápido:' : 'Faster:',
      linkLabel: pt ? 'mensagem no LinkedIn' : 'message on LinkedIn',
      linkGlyph: '↗',
      linkHref: LINKEDIN_URL,
    },
    dismiss: {
      label: '[ ok ]',
      aria: pt
        ? 'Dispensar o aviso e escrever outra mensagem'
        : 'Dismiss this notice and write another message',
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
      loading: pt
        ? 'sincronizando relógios com seu fuso horário'
        : 'syncing clocks with your timezone',
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
        label: pt
          ? 'Não é esse? Busque sua cidade ou fuso horário'
          : 'Not right? Search your city or timezone',
        placeholder: pt ? 'ex.: Lisboa ou Europe/Lisbon' : 'e.g. Lisbon or Europe/Lisbon',
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
      requiredNote: pt ? 'Todos os campos são obrigatórios.' : 'All fields are required.',
      namePlaceholder: pt ? 'seu nome' : 'your name',
      emailPlaceholder: 'you@company.com',
      messagePlaceholder: pt ? '[PRONTO PARA RECEBER DADOS...]' : '[READY FOR DATA INPUT...]',
      submit: pt ? 'EXECUTAR_ENVIO' : 'EXECUTE_SEND',
      submitting: pt ? 'ENVIANDO...' : 'SENDING...',
      sending: pt ? 'enviando…' : 'sending…',
      waiting: pt ? 'aguardando override manual... _' : 'waiting for manual override... _',
      statusInvalid: pt ? 'corrija os campos marcados... _' : 'fix the marked fields... _',
      statusFailed: pt ? 'envio falhou, tente de novo... _' : 'send failed, retry when ready... _',
      errorPrefix: pt ? 'erro:' : 'error:',
      errorSummary: {
        one: pt ? '! 1 campo precisa de ajuste:' : '! 1 field needs fixing:',
        many: pt ? '! {count} campos precisam de ajuste:' : '! {count} fields need fixing:',
        separator: ' · ',
      },
      retained: pt ? 'Seu texto continua aqui.' : 'Your text is still here.',
      retryEmail: pt ? 'Tente novamente, ou envie email' : 'Retry, or email',
      mailtoSubject: pt ? '[ref {ref}] contato' : '[ref {ref}] contact',
      mailtoBody: pt ? 'ref: {ref}\n\n{text}' : 'ref: {ref}\n\n{text}',
      counterSeparator: '/',
      privacy: pt
        ? 'A mensagem fica salva por 90 dias para Erik poder responder, depois é excluída. A cópia enviada por email fica na caixa de entrada dele e nos logs do provedor de email, sem esse prazo. Seu IP é hasheado antes de virar chave ou registro, inclusive no rate limiting. Não é compartilhada com mais ninguém.'
        : "Your message is stored 90 days so Erik can reply, then deleted. The copy emailed to him stays in his inbox and the email provider's logs, without that limit. Your IP is hashed before it becomes a key or a record, rate limiting included. Not shared with anyone else.",
      fieldLabels: {
        name: pt ? 'nome' : 'name',
        email: 'email',
        message: pt ? 'mensagem' : 'message',
      },
    },
    errors: {
      name: {
        required: pt ? 'informe seu nome' : 'add your name',
        tooLong: pt
          ? 'use no máximo {max} caracteres, você tem {count}'
          : 'use at most {max} characters, you have {count}',
      },
      email: {
        empty: pt
          ? 'informe seu email, por exemplo {example}'
          : 'add your email, for example {example}',
        missingAt: pt ? 'falta o @, por exemplo {example}' : 'missing the @, for example {example}',
        missingDomain: pt
          ? 'falta o domínio, por exemplo {example}'
          : 'missing the domain, for example {example}',
        invalid: pt
          ? 'confira o formato, por exemplo {example}'
          : 'check the format, for example {example}',
        example: pt ? 'voce@empresa.com' : 'you@company.com',
      },
      message: {
        tooShort: pt
          ? 'escreva ao menos {min} caracteres, você tem {count}'
          : 'write at least {min} characters, you have {count}',
        tooLong: pt
          ? 'use no máximo {max} caracteres, você tem {count}'
          : 'use at most {max} characters, you have {count}',
      },
      storageUnavailable: pt
        ? 'não foi possível salvar sua mensagem'
        : 'could not save your message',
      retryUnavailable: pt
        ? 'sua mensagem ainda não pôde ser entregue'
        : 'your message could not be delivered yet',
      forbiddenOrigin: pt
        ? 'este formulário só funciona no próprio site'
        : 'this form only works on the site itself',
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
