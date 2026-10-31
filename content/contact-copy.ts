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
    reply: 'Replies within 48h',
    linkedinPrompt: 'Prefer LinkedIn?',
    linkedinLabel: 'Message me there ↗',
    emailLabel: 'email:',
    email: EMAIL_ADDRESS,
    linkedinHref: LINKEDIN_URL,
    copyEmail: '[COPY EMAIL]',
    copyEmailCopied: '[COPIED]',
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
    errorSummary: 'Fields need attention:',
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
