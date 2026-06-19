// lib/__tests__/env.test.ts
// WS1: lib/env.ts is the single, typed, format-validating accessor for
// application-managed environment variables.
//
// Contract (reconciled with the architect-gate correction):
//  - Secrets are OPTIONAL. Absence NEVER throws at boot (a boot throw would
//    block Vercel OIDC builds and break the fail-open Redis path). Use sites
//    keep their own lazy throws.
//  - A PRESENT-but-malformed value DOES throw at module load, with a precise
//    message naming the offending variable (fail-fast on misconfiguration).
//  - ASK_ENABLED and DEPLOY_SALT resolve to `undefined` when unset — never an
//    OFF keyword, never the 'portfolio' literal — preserving the kill-switch
//    and privacy-salt contracts.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const MANAGED = [
  'AI_GATEWAY_API_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'RESEND_API_KEY',
  'PSI_API_KEY',
  'CRON_SECRET',
  'ASK_ENABLED',
  'DEPLOY_SALT',
  'LANGFUSE_ENABLED',
  'LANGFUSE_SECRET_KEY',
  'LANGFUSE_PUBLIC_KEY',
  'LANGFUSE_BASEURL',
] as const;

beforeEach(() => {
  vi.resetModules();
  // Clean slate: force every managed var to "unset". Stub to '' (not a cast to
  // undefined) — lib/env.ts coerces '' → undefined, matching the repo's "X=
  // means unset" convention, so each test starts from a known-absent baseline.
  for (const key of MANAGED) vi.stubEnv(key, '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('lib/env.ts — boot-time config integrity', () => {
  it('does NOT throw when every secret is absent (optional-by-design)', async () => {
    const mod = await import('@/lib/env');
    expect(mod.env.AI_GATEWAY_API_KEY).toBeUndefined();
    expect(mod.env.UPSTASH_REDIS_REST_URL).toBeUndefined();
    expect(mod.env.RESEND_API_KEY).toBeUndefined();
  });

  it('exposes present, valid values typed', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://demo.upstash.io');
    vi.stubEnv('RESEND_API_KEY', 're_live_123');
    const { env } = await import('@/lib/env');
    expect(env.UPSTASH_REDIS_REST_URL).toBe('https://demo.upstash.io');
    expect(env.RESEND_API_KEY).toBe('re_live_123');
  });

  it('throws at module load naming a present-but-malformed URL', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'not-a-valid-url');
    await expect(import('@/lib/env')).rejects.toThrow(/UPSTASH_REDIS_REST_URL/);
  });

  it('treats a present-but-empty value as absent (X= means unset, no throw)', async () => {
    // `.env.local` legitimately ships `DEPLOY_SALT=` to mean "auto-generate".
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('DEPLOY_SALT', '');
    const { env } = await import('@/lib/env');
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.DEPLOY_SALT).toBeUndefined();
  });

  it('resolves ASK_ENABLED to undefined when unset (kill-switch stays live)', async () => {
    const { env } = await import('@/lib/env');
    expect(env.ASK_ENABLED).toBeUndefined();
    // Critically, never an OFF keyword by default.
    expect(['false', '0', 'off', 'no', 'disabled']).not.toContain(env.ASK_ENABLED);
  });

  it('resolves DEPLOY_SALT to undefined when unset (never the literal fallback)', async () => {
    const { env } = await import('@/lib/env');
    expect(env.DEPLOY_SALT).toBeUndefined();
    expect(env.DEPLOY_SALT).not.toBe('portfolio');
  });

  it('imports server-only before parsing so a client bundle fails loudly', () => {
    // behavioral-test-allow: WS1 — assert the server-only guard precedes the parse.
    const src = readFileSync(join(process.cwd(), 'lib/env.ts'), 'utf8');
    const serverOnlyIdx = src.indexOf("import 'server-only'");
    const parseIdx = src.search(/\.safeParse\(|\.parse\(/);
    expect(serverOnlyIdx).toBeGreaterThanOrEqual(0);
    expect(serverOnlyIdx).toBeLessThan(parseIdx);
  });

  it('is the only place managed vars are read from process.env (no stray reads)', () => {
    // behavioral-test-allow: WS1 env-centralization invariant — scan app/ + lib/.
    // Scope is runtime code only. scripts/ (ask-eval.ts, gates-runtime.ts) is
    // intentionally excluded: those standalone tsx harnesses run outside the
    // Next.js runtime and keep their own direct process.env reads by design.
    // (They CAN import lib/env.ts — scripts/tsconfig.eval.json aliases
    // `server-only` — so the exclusion is a scope choice, not an import limit.)
    const roots = ['app', 'lib'];
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === 'node_modules' || e.name === '__tests__') return [];
          // lib/eval/ is eval-harness code: it is imported ONLY by the standalone
          // tsx harnesses (scripts/ask-eval.ts, scripts/agent-eval.ts), never by
          // the Next.js runtime (no app/ module imports it). It runs outside the
          // runtime boundary and keeps its own direct process.env presence guards
          // by design — the SAME rationale that excludes scripts/ above. Scoping
          // this invariant to runtime code, not harness code, keeps it precise.
          if (full.endsWith(join('lib', 'eval'))) return [];
          return walk(full);
        }
        return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [full] : [];
      });
    const offenders: string[] = [];
    for (const file of roots.flatMap((r) => walk(join(process.cwd(), r)))) {
      if (file.endsWith(`${join('lib', 'env.ts')}`)) continue; // the schema module itself
      const src = readFileSync(file, 'utf8');
      for (const key of MANAGED) {
        // Cover dot- AND bracket-access (process.env.KEY / process.env['KEY'] /
        // process.env["KEY"]) so a bracket read can't silently bypass the guard.
        const forms = [`process.env.${key}`, `process.env['${key}']`, `process.env["${key}"]`];
        if (forms.some((form) => src.includes(form))) {
          offenders.push(`${file} → process.env.${key}`);
        }
      }
    }
    expect(offenders, `stray managed process.env reads:\n${offenders.join('\n')}`).toEqual([]);
  });
});
