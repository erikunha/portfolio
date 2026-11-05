import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

const AUTHORIZATION_HEADER = 'authorization';
const BEARER_PREFIX = 'Bearer ';

const digest = (value: string) => createHash('sha256').update(value).digest();

export function isCronAuthorized(req: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const presented = req.headers.get(AUTHORIZATION_HEADER) ?? '';
  return timingSafeEqual(digest(presented), digest(`${BEARER_PREFIX}${secret}`));
}
