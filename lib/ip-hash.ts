// lib/ip-hash.ts
// Server-only IP hashing utility. Same pattern across all routes that persist
// IP for rate-limit accounting or per-IP triage: SHA-256 over (ip + salt),
// hex-encoded, first 16 chars. Centralised to prevent salt/length divergence
// between call sites (security-adjacent — diverging copies hide subtle bugs).

import 'server-only';

const DEPLOY_SALT = (() => {
  const salt = process.env.DEPLOY_SALT;
  if (salt) return salt;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'DEPLOY_SALT is required in production. ' +
        'Without it, IP hashes use a publicly-known constant ("portfolio") ' +
        'which defeats the salt threat model — an attacker who suspects ' +
        'a target IP can confirm its presence in any leaked KV record. ' +
        'Set DEPLOY_SALT in the Vercel environment for production and preview.',
    );
  }
  return 'portfolio';
})();

export async function hashIp(ip: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + DEPLOY_SALT));
  return Buffer.from(bytes).toString('hex').slice(0, 16);
}
