export interface ContactContent {
  success: { title: string; message: string };
  queued: { title: string; message: string; linkLabel: string; linkHref: string };
  form: {
    nameLabel: string;
    emailLabel: string;
    messageLabel: string;
    requiredPlaceholder: string;
    messagePlaceholder: string;
    submit: string;
    submitting: string;
    waiting: string;
    errorPrefix: string;
  };
  errors: {
    storageUnavailable: string;
    retryUnavailable: string;
    rateLimited: string;
    requestFailed: string;
  };
}

export const CONTACT_DELIVERY_CODE = { QUEUED: 'queued' } as const;
const CONTACT_LINKEDIN_URL = 'https://www.linkedin.com/in/erikunha/';

export const contactContent: ContactContent = {
  success: {
    title: 'EXECUTE_SEND :: SUCCESS',
    message: 'handshake initiated · expect reply within 48h',
  },
  queued: {
    title: 'EXECUTE_SEND :: QUEUED',
    message: 'saved, not delivered yet; delivery is retried automatically; for a faster reply use',
    linkLabel: 'LinkedIn',
    linkHref: CONTACT_LINKEDIN_URL,
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

export const contactRetryAlertContent = {
  subject: '[portfolio] contact retry messages dropped',
  message:
    'Contact messages were removed from the delivery outbox without provider acceptance. Audit records remain available in Redis.',
};
