import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { log } from '@/lib/log';

const AUTHORIZATION_HEADER = 'authorization';
const BEARER_PREFIX = 'Bearer ';

export const CRON_SECRET_MIN_LENGTH = 16;

const digest = (value: string) => createHash('sha256').update(value).digest();

export function isCronAuthorized(req: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  if (secret.length < CRON_SECRET_MIN_LENGTH) {
    log.error('CRON_SECRET is shorter than the minimum, refusing cron requests', {
      minLength: CRON_SECRET_MIN_LENGTH,
    });
    return false;
  }
  const presented = req.headers.get(AUTHORIZATION_HEADER) ?? '';
  return timingSafeEqual(digest(presented), digest(`${BEARER_PREFIX}${secret}`));
}
