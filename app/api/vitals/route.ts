import { HTTP_STATUS } from '@/lib/http-status';
import { log } from '@/lib/log';
import { getVitalsDailyLimit, getVitalsIpDailyLimit, getVitalsLimit } from '@/lib/rate-limit';
import { getRedis } from '@/lib/redis';
import type { RateLimitIdentifier } from '@/lib/server/rate-limit-key';
import { defineHandler, err, ok } from '@/lib/server/route';
import { toVitalRecords } from '@/lib/vitals/records';
import { VITALS_MAX_BODY_BYTES, VitalsPayload } from '@/lib/vitals/schema';
import { storeVitals } from '@/lib/vitals/store';

async function underDailyCaps(ipHash: RateLimitIdentifier, requestId: string): Promise<boolean> {
  try {
    const { success } = await getVitalsIpDailyLimit().limit(ipHash);
    if (!success) {
      log.warn('vitals per-IP daily cap reached, dropping record', { requestId });
      return false;
    }
  } catch (capErr) {
    log.warn('vitals per-IP daily cap unavailable, recording anyway', { requestId, err: capErr });
  }
  try {
    const { success } = await getVitalsDailyLimit().limit();
    if (!success) {
      log.warn('vitals daily cap reached, dropping record', { requestId });
      return false;
    }
  } catch (capErr) {
    log.warn('vitals daily cap unavailable, recording anyway', { requestId, err: capErr });
  }
  return true;
}

export const POST = defineHandler({
  schema: VitalsPayload,
  maxBodyBytes: VITALS_MAX_BODY_BYTES,
  rateLimit: getVitalsLimit,
  rateLimitErrorMessage: 'too many vitals reports',
  async handler({ body, ipHash, requestId }) {
    if (!(await underDailyCaps(ipHash, requestId))) return ok({ requestId });
    try {
      await storeVitals(getRedis(), toVitalRecords(body), new Date());
    } catch (kvErr) {
      log.error('vitals KV write failed', { requestId, err: kvErr });
      return err({
        requestId,
        status: HTTP_STATUS.serviceUnavailable,
        code: 'storage_unavailable',
        message: 'storage unavailable',
      });
    }
    return ok({ requestId });
  },
});
