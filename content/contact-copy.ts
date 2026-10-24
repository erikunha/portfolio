import type { ContactContent } from './contact';

export const CONTACT_DELIVERY_CODE = { QUEUED: 'queued' } as const;
const LINKEDIN_URL = 'https://www.linkedin.com/in/erikunha/';

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
  form: {
    nameLabel: '$ name:',
    emailLabel: '$ email:',
    messageLabel: '$ message:',
    requiredPlaceholder: '[INPUT REQUIRED]',
    messagePlaceholder: '[READY FOR DATA INPUT...]',
    submit: 'EXECUTE_SEND',
    submitting: 'TRANSMITTING...',
    waiting: 'waiting for manual override... _',
    errorPrefix: 'error:',
  },
  errors: {
    storageUnavailable: 'storage unavailable, try again',
    retryUnavailable: 'delivery retry unavailable, try again or use LinkedIn',
    rateLimited: 'too many requests, try again in 10 minutes',
    requestFailed: 'message could not be sent, try again',
  },
};
