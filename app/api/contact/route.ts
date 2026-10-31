import { contactContent } from '@/content/contact';
import { CONTACT_DELIVERY_CODE } from '@/content/contact-copy';
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

const HONEYPOT_JITTER_MIN_MS = 50;
const HONEYPOT_JITTER_MAX_MS = 150;

const STORAGE_UNAVAILABLE_STATUS = 502;
const QUEUED_STATUS = 202;
const STORAGE_UNAVAILABLE_CODE = 'storage_unavailable';

export const POST = defineHandler({
  schema: ContactSchema,
  rateLimit: getContactLimit,
  rateLimitErrorMessage: contactContent.errors.rateLimited,
  async handler({ body, ipHash, requestId }) {
    if (isHoneypotTripped(body)) {
      log.info('contact honeypot tripped', { requestId });
      const jitterMs =
        HONEYPOT_JITTER_MIN_MS +
        Math.floor(Math.random() * (HONEYPOT_JITTER_MAX_MS - HONEYPOT_JITTER_MIN_MS));
      await new Promise((r) => setTimeout(r, jitterMs));
      return ok({ requestId });
    }

    const { name, email, message } = body;

    const msgId = crypto.randomUUID();
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
        code: STORAGE_UNAVAILABLE_CODE,
        message: contactContent.errors.storageUnavailable,
      });
    }

    if (await sendContactMessage(msgId, payload, requestId)) return ok({ requestId });

    try {
      await enqueueContact(msgId, payload.receivedAt);
    } catch {
      log.error('contact outbox write failed', { requestId, msgId });
      return err({
        requestId,
        status: STORAGE_UNAVAILABLE_STATUS,
        code: STORAGE_UNAVAILABLE_CODE,
        message: contactContent.errors.retryUnavailable,
      });
    }

    return err({
      requestId,
      status: QUEUED_STATUS,
      code: CONTACT_DELIVERY_CODE.QUEUED,
      message: `${contactContent.queued.message} ${contactContent.queued.linkLabel}`,
    });
  },
});
