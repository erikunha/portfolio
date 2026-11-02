import type { ContactContent } from './contact';
import { EMAIL_ADDRESS, LINKEDIN_URL } from './social-urls';

export const CONTACT_LIMITS = {
  nameMin: 1,
  nameMax: 120,
  messageMin: 10,
  messageMax: 2_000,
} as const;

export const CONTACT_FIELD = {
  NAME: 'name',
  EMAIL: 'email',
  MESSAGE: 'message',
} as const;

export type ContactField = (typeof CONTACT_FIELD)[keyof typeof CONTACT_FIELD];

export const CONTACT_DELIVERY_CODE = { QUEUED: 'queued' } as const;

const REPLY_WINDOW = 'within 48h';
const ERIK_PLACE = 'São Paulo';

export const contactCopy: ContactContent = {
  success: {
    title: 'EXECUTE_SEND :: SUCCESS',
    message: 'handshake initiated · expect reply within 48h',
  },
  queued: {
    title: 'EXECUTE_SEND :: QUEUED',
    message: 'saved, not delivered yet; delivery is retried automatically; for a faster reply use',
    linkLabel: 'LinkedIn',
    linkHref: LINKEDIN_URL,
  },
  section: {
    command: 'SUDO CONTACT --INIT',
    mobileCommand: 'SUDO CONTACT',
    email: EMAIL_ADDRESS,
    linkedinHref: LINKEDIN_URL,
    copyEmail: '[COPY EMAIL]',
    copyEmailCopied: '[COPIED]',
  },
  channels: {
    title: 'LS -L ~/CHANNELS',
    marker: '▌',
    emailLabel: 'email',
    linkedinLabel: 'linkedin',
    linkedinCta: 'MESSAGE_ON_LINKEDIN',
    linkedinGlyph: '↗',
    linkedinNewTabNote: '(opens in a new tab)',
    githubLabel: 'github',
    githubAccessibleLabel: 'github.com/erikunha (opens in a new tab)',
    replyLabel: 'reply',
    replyValue: REPLY_WINDOW,
    languagesLabel: 'lang',
    timezoneLabel: 'tz',
  },
  timezone: {
    status: {
      online: 'ONLINE NOW · likely to reply today',
      offHours: 'OFF HOURS · back in ~{hours}h, message anyway',
    },
    clocks: { erik: 'erik', you: 'you', link: '⇄' },
    map: {
      erikPlace: ERIK_PLACE,
      erikLabel: 'erik · {code}',
      youLabel: 'you · {code}',
      ariaLabel:
        'World map. Erik in {erikPlace}, you in {place}, {overlap} of shared working time.',
    },
    location: {
      youAre: 'You are in',
      detectedAuto: 'auto-detected · {zone}',
      detectedManual: 'set by you · {zone}',
    },
    search: {
      label: 'Search your city or timezone',
      placeholder: 'not right? search city or timezone…',
      listLabel: 'Timezones',
      count: '{matches} of {total} timezones · from your browser, no download',
    },
    rows: { erik: 'erik', you: 'you', both: 'both' },
    axis: ['00', '06', '12', '18', '24'],
    slot: {
      title: 'best slot for a call',
      you: 'you',
      erik: 'erik',
      none: 'no live window, async only',
    },
    propose: {
      label: 'PROPOSE_IN_MESSAGE ↙',
      line: `Proposed call: {you} your time ({zone}), {erik} Erik time (${ERIK_PLACE})`,
    },
    overlap: {
      summary: '{hours} overlap',
      range: '{range} your time',
      none: `async works, reply ${REPLY_WINDOW}`,
      separator: ' · ',
    },
    hours: { one: '{count} hour', other: '{count} hours' },
    facts: {
      availabilityLabel: 'start',
      modeLabel: 'mode',
      modeValue: 'remote-first · EU/US/CA',
      relocationLabel: 'visa',
      relocationValue: 'open to relocation with visa sponsorship',
      engagementLabel: 'type',
      engagementValue: 'full-time or contract',
      replyLabel: 'reply',
      replyValue: REPLY_WINDOW,
    },
    announce: 'Erik local time {erik}. Your local time {you}.',
  },
  form: {
    nameLabel: '$ name:',
    emailLabel: '$ email:',
    messageLabel: '$ message:',
    namePlaceholder: 'your name',
    emailPlaceholder: 'you@company.com',
    messagePlaceholder: '[READY FOR DATA INPUT...]',
    submit: 'EXECUTE_SEND',
    submitting: 'TRANSMITTING...',
    waiting: 'waiting for manual override... _',
    errorPrefix: 'error:',
    errorSummary: {
      one: '1 field needs attention:',
      many: '{count} fields need attention:',
      separator: ' · ',
    },
    retained: 'Your text is still here.',
    retryEmail: 'Retry, or email',
    counterSeparator: '/',
    privacy:
      'Kept 90 days so Erik can reply, then deleted. IP hashed for rate limiting. Never shared.',
    fieldLabels: { name: 'name', email: 'email', message: 'message' },
  },
  errors: {
    name: `error: name is required, ${CONTACT_LIMITS.nameMin} to ${CONTACT_LIMITS.nameMax} characters`,
    email: 'error: email needs an @ and a domain, like name@site.com',
    message: `error: message needs ${CONTACT_LIMITS.messageMin} to ${CONTACT_LIMITS.messageMax} characters`,
    storageUnavailable: 'storage unavailable, try again',
    retryUnavailable: 'delivery retry unavailable, try again or use LinkedIn',
    rateLimited: 'too many requests, try again in 10 minutes',
    requestFailed: 'message could not be sent, try again',
  },
};

export function contactErrorSummary(count: number): string {
  const { one, many } = contactCopy.form.errorSummary;
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

export function contactHoursPhrase(hours: number): string {
  const { one, other } = contactCopy.timezone.hours;
  return fillCopy(hours === SINGULAR_HOURS ? one : other, {
    count: Number(hours.toFixed(HOURS_DECIMALS)),
  });
}
