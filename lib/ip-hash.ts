// lib/ip-hash.ts
// Server-only IP hashing utility. Same pattern across all routes that persist
// IP for rate-limit accounting or per-IP triage: SHA-256 over (ip + salt),
// hex-encoded, first 16 chars. Centralised to prevent salt/length divergence
// between call sites (security-adjacent — diverging copies hide subtle bugs).

import 'server-only';

export async function hashIp(ip: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(ip + (process.env.DEPLOY_SALT ?? 'portfolio')),
  );
  return Buffer.from(bytes).toString('hex').slice(0, 16);
}
