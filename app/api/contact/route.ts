import { contactContent } from '@/content/contact';
import { CONTACT_DELIVERY_CODE, CONTACT_ERROR_CODE } from '@/content/contact-rules';
import { DEFAULT_SITE_LOCALE, SITE_LOCALES, type SiteLocale } from '@/content/site-locale';
import { sendContactMessage } from '@/lib/contact-delivery';
import {
  CONTACT_MESSAGE_TTL_SECONDS,
  contactMessageKey,
  enqueueContact,
} from '@/lib/contact-outbox';
import { ContactSchema, isHoneypotTripped } from '@/lib/contact-validation';
import { log } from '@/lib/log';
import { getContactLimit, getRedis } from '@/lib/rate-limit';
import { defineHandler, err, ok } from '@/lib/server/route';
import { ASK_LOCALE_HEADER } from '@/lib/stream-protocol';

const HONEYPOT_JITTER_MIN_MS = 50;
const HONEYPOT_JITTER_MAX_MS = 150;

const STORAGE_UNAVAILABLE_STATUS = 502;
const QUEUED_STATUS = 202;
const MAX_CONTACT_BODY_BYTES = 16_384;

function requestLocale(req: Request): SiteLocale {
  const header = req.headers.get(ASK_LOCALE_HEADER);
  return SITE_LOCALES.find((locale) => locale === header) ?? DEFAULT_SITE_LOCALE;
}

const handleContact = defineHandler({
  schema: ContactSchema,
  maxBodyBytes: MAX_CONTACT_BODY_BYTES,
  rateLimit: getContactLimit,
  rateLimitErrorMessage: Object.fromEntries(
    SITE_LOCALES.map((locale) => [locale, contactContent[locale].errors.rateLimited]),
  ) as Record<SiteLocale, string>,
  async handler({ body, ipHash, requestId, req }) {
    const copy = contactContent[requestLocale(req)];
    if (isHoneypotTripped(body)) {
      log.info('contact honeypot tripped', { requestId });
      const jitterMs =
        HONEYPOT_JITTER_MIN_MS +
        Math.floor(Math.random() * (HONEYPOT_JITTER_MAX_MS - HONEYPOT_JITTER_MIN_MS));
      await new Promise((r) => setTimeout(r, jitterMs));
      return ok({ requestId });
    }

    const { name, email, message } = body;

    const msgId = requestId;
    const payload = { name, email, message, receivedAt: new Date().toISOString(), ipHash };

    try {
      await getRedis().set(contactMessageKey(msgId), JSON.stringify(payload), {
        ex: CONTACT_MESSAGE_TTL_SECONDS,
      });
    } catch {
      log.error('KV write failed', { requestId, msgId });
      return err({
        requestId,
        status: STORAGE_UNAVAILABLE_STATUS,
        code: CONTACT_ERROR_CODE.STORAGE_UNAVAILABLE,
        message: copy.errors.storageUnavailable,
      });
    }

    if (await sendContactMessage(msgId, payload, requestId)) return ok({ requestId });

    let queued = false;
    try {
      queued = await enqueueContact(msgId, payload.receivedAt);
      if (!queued) log.warn('contact outbox full', { requestId, msgId });
    } catch {
      log.error('contact outbox write failed', { requestId, msgId });
    }
    if (!queued) {
      try {
        await getRedis().del(contactMessageKey(msgId));
      } catch {
        log.error('contact message cleanup failed', { requestId, msgId });
      }
      return err({
        requestId,
        status: STORAGE_UNAVAILABLE_STATUS,
        code: CONTACT_ERROR_CODE.DELIVERY_UNAVAILABLE,
        message: copy.errors.retryUnavailable,
      });
    }

    return err({
      requestId,
      status: QUEUED_STATUS,
      code: CONTACT_DELIVERY_CODE.QUEUED,
      message: copy.queued.message,
    });
  },
});

export const POST = handleContact;
