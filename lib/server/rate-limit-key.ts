import 'server-only';

import { hashIp } from '@/lib/ip-hash';
import { getClientIp } from '@/lib/rate-limit';

declare const rateLimitIdentifierBrand: unique symbol;

export type RateLimitIdentifier = string & { readonly [rateLimitIdentifierBrand]: true };

export async function clientRateLimitKey(req: { headers: Headers }): Promise<RateLimitIdentifier> {
  return (await hashIp(getClientIp(req))) as RateLimitIdentifier;
}
