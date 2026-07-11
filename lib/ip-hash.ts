import 'server-only';

import { env } from '@/lib/env';
import { getRedis } from '@/lib/rate-limit';

const SALT_KEY = 'meta:deploy-salt';
const SALT_BYTES = 32;

let resolvedSalt: string | null = null;
let resolvePromise: Promise<string> | null = null;

async function resolveSalt(): Promise<string> {
  const envSalt = env.DEPLOY_SALT;
  if (envSalt) return envSalt;

  if (process.env.NODE_ENV !== 'production') {
    return 'portfolio';
  }

  const redis = getRedis();

  const existing = await redis.get<string>(SALT_KEY);
  if (typeof existing === 'string' && existing.length > 0) {
    return existing;
  }

  const bytes = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(bytes);
  const generated = Buffer.from(bytes).toString('base64');

  const setResult = await redis.set(SALT_KEY, generated, { nx: true });
  if (setResult === 'OK') return generated;

  const winner = await redis.get<string>(SALT_KEY);
  if (typeof winner === 'string' && winner.length > 0) return winner;

  throw new Error(
    'DEPLOY_SALT auto-resolution failed: Upstash did not persist the salt. ' +
      'Set the DEPLOY_SALT environment variable manually as an escape hatch.',
  );
}

export async function hashIp(ip: string): Promise<string> {
  if (!resolvedSalt) {
    if (!resolvePromise) {
      resolvePromise = resolveSalt()
        .then((salt) => {
          resolvedSalt = salt;
          return salt;
        })
        .catch((err: unknown) => {
          resolvePromise = null;
          throw err;
        });
    }
    await resolvePromise;
  }
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + resolvedSalt));
  return Buffer.from(bytes).toString('hex').slice(0, 16);
}
