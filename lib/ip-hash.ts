// lib/ip-hash.ts
// Server-only IP hashing utility. Same pattern across all routes that persist
// IP for rate-limit accounting or per-IP triage: SHA-256 over (ip + salt),
// hex-encoded, first 16 chars. Centralised to prevent salt/length divergence
// between call sites (security-adjacent — diverging copies hide subtle bugs).
//
// Salt resolution (lazy, on first hashIp call):
//   1. process.env.DEPLOY_SALT — explicit operator-set value
//   2. Upstash KV `meta:deploy-salt` — auto-generated on first deploy,
//      persisted with SETNX so concurrent cold-starts converge on one value
//   3. 'portfolio' literal — non-production fallback only
//
// This eliminates the manual Vercel UI step previously required and keeps
// the salt stable across deploys (until the Upstash record is wiped or the
// env var is explicitly set). See DECISIONS.md 2026-05-19 for the rationale
// + trade-offs.

import 'server-only';

import { getRedis } from '@/lib/rate-limit';

const SALT_KEY = 'meta:deploy-salt';
const SALT_BYTES = 32;

let resolvedSalt: string | null = null;
let resolvePromise: Promise<string> | null = null;

async function resolveSalt(): Promise<string> {
  // Explicit env wins.
  const envSalt = process.env.DEPLOY_SALT;
  if (envSalt) return envSalt;

  // Non-production: literal fallback for local dev + tests.
  if (process.env.NODE_ENV !== 'production') {
    return 'portfolio';
  }

  // Production: read or generate via Upstash.
  const redis = getRedis();

  const existing = await redis.get<string>(SALT_KEY);
  if (typeof existing === 'string' && existing.length > 0) {
    return existing;
  }

  // Generate a fresh 32-byte random salt, base64-encoded.
  const bytes = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(bytes);
  const generated = Buffer.from(bytes).toString('base64');

  // SETNX: 'OK' if we set, null if a concurrent cold-start beat us.
  const setResult = await redis.set(SALT_KEY, generated, { nx: true });
  if (setResult === 'OK') return generated;

  // Race lost — read the winner.
  const winner = await redis.get<string>(SALT_KEY);
  if (typeof winner === 'string' && winner.length > 0) return winner;

  // Defensive: SETNX returned null but GET still misses. Should never
  // happen unless Upstash dropped the key between SET and GET. Throw
  // honestly rather than silently fall back to a known constant.
  throw new Error(
    'DEPLOY_SALT auto-resolution failed: Upstash did not persist the salt. ' +
      'Set process.env.DEPLOY_SALT manually as an escape hatch.',
  );
}

export async function hashIp(ip: string): Promise<string> {
  if (!resolvedSalt) {
    if (!resolvePromise) {
      resolvePromise = resolveSalt().then((salt) => {
        resolvedSalt = salt;
        return salt;
      });
    }
    await resolvePromise;
  }
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + resolvedSalt));
  return Buffer.from(bytes).toString('hex').slice(0, 16);
}
