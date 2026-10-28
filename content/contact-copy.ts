import { CONTACT_LIMITS } from '@/lib/contact-validation';
import type { ContactContent } from './contact';
import { social } from './social';
import { LINKEDIN_URL } from './social-urls';

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
    title: 'Contact',
    reply: 'Replies within 48h',
    linkedinPrompt: 'Prefer LinkedIn?',
    linkedinLabel: 'Message me there ↗',
    emailLabel: 'email:',
    email: social.email,
    linkedinHref: LINKEDIN_URL,
    copyEmail: 'Copy email',
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
