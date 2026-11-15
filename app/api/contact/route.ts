import { contactContent } from '@/content/contact';
import { CONTACT_DELIVERY_CODE, CONTACT_ERROR_CODE } from '@/content/contact-rules';
import { SITE_LOCALES, type SiteLocale } from '@/content/site-locale';
import { sendContactMessage } from '@/lib/contact/delivery';
import { deleteContactMessage, enqueueContact, saveContactMessage } from '@/lib/contact/outbox';
import { submitContact } from '@/lib/contact/submit';
import { ContactSchema, isHoneypotTripped } from '@/lib/contact/validation';
import { HTTP_STATUS } from '@/lib/http-status';
import { log } from '@/lib/log';
import { getContactLimit } from '@/lib/rate-limit';
import { localeFromRequest } from '@/lib/server/request-locale';
import { defineHandler, err, ok } from '@/lib/server/route';

const HONEYPOT_JITTER_MIN_MS = 50;
const HONEYPOT_JITTER_MAX_MS = 150;

const MAX_CONTACT_BODY_BYTES = 16_384;

const handleContact = defineHandler({
  schema: ContactSchema,
  maxBodyBytes: MAX_CONTACT_BODY_BYTES,
  rateLimit: getContactLimit,
  rateLimitErrorMessage: Object.fromEntries(
    SITE_LOCALES.map((locale) => [locale, contactContent[locale].errors.rateLimited]),
  ) as Record<SiteLocale, string>,
  async handler({ body, ipHash, requestId, req }) {
    const copy = contactContent[localeFromRequest(req)];
    if (isHoneypotTripped(body)) {
      log.info('contact honeypot tripped', { requestId });
      const jitterMs =
        HONEYPOT_JITTER_MIN_MS +
        Math.floor(Math.random() * (HONEYPOT_JITTER_MAX_MS - HONEYPOT_JITTER_MIN_MS));
      await new Promise((r) => setTimeout(r, jitterMs));
      return ok({ requestId });
    }

    const { name, email, message } = body;

    const outcome = await submitContact(
      { msgId: requestId, requestId, name, email, message, ipHash },
      {
        saveMessage: saveContactMessage,
        deleteMessage: deleteContactMessage,
        enqueue: enqueueContact,
        deliver: sendContactMessage,
        now: Date.now,
        log,
      },
    );

    switch (outcome) {
      case 'sent':
        return ok({ requestId });
      case 'storage_failed':
        return err({
          requestId,
          status: HTTP_STATUS.badGateway,
          code: CONTACT_ERROR_CODE.STORAGE_UNAVAILABLE,
          message: copy.errors.storageUnavailable,
        });
      case 'outbox_failed':
        return err({
          requestId,
          status: HTTP_STATUS.badGateway,
          code: CONTACT_ERROR_CODE.DELIVERY_UNAVAILABLE,
          message: copy.errors.retryUnavailable,
        });
      case 'queued':
        return err({
          requestId,
          status: HTTP_STATUS.accepted,
          code: CONTACT_DELIVERY_CODE.QUEUED,
          message: copy.queued.message,
        });
    }
  },
});

export const POST = handleContact;
