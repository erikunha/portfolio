// lib/env.ts
// Single, typed, format-validating accessor for application-managed environment
// variables. Hand-rolled with the already-pinned `zod` (no env-validation
// dependency) — the pattern is the point.
//
// DESIGN (reconciled with the 2026-06-04 architect-gate correction):
//   Every external SECRET is OPTIONAL. Absence MUST NOT throw at module load:
//     - AI_GATEWAY_API_KEY is resolved by the AI SDK from the Vercel OIDC token
//       and is intentionally unset on deploys — a boot throw blocks every build.
//     - UPSTASH_* are read as presence guards behind a fail-open Redis path — a
//       boot throw makes the ask route fail to import, so fail-open never runs.
//     - RESEND_API_KEY is used behind lazy `if (!key) throw` in contact/psi —
//       a shared boot throw would crash the ask route on a missing email secret.
//   So this module fails fast at load ONLY on a present, NON-empty, wrong-format
//   value (e.g. a non-URL Upstash URL), naming the offender. An empty string is
//   coerced to `undefined` (treated as absent) and never throws. Use sites keep
//   their own lazy throws (and the fail-open wrappers in lib/rate-limit.ts stay).
//
//   ASK_ENABLED and DEPLOY_SALT carry NO default: unset resolves to `undefined`
//   so the kill switch stays live and ip-hash auto-generates the salt in prod.
//   A default OFF keyword or 'portfolio' literal would silently break both.
//
// `import 'server-only'` precedes the parse so a stray client-bundle import
// fails with the server-only error rather than an opaque schema error.

import 'server-only';

import { z } from 'zod';

// In env-var land, `X=` (empty string) universally means "not set" — e.g.
// `.env.local` ships `DEPLOY_SALT=` to signal "auto-generate via Upstash", and
// lib/ip-hash treats a falsy salt as absent. Coerce empty → undefined BEFORE
// validation so an empty value reads as ABSENT, not malformed. The remaining
// fail-fast surface is a present, NON-empty, badly-FORMATTED value (e.g. a
// non-URL Upstash URL), which throws at boot naming the offender.
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const EnvSchema = z.object({
  // External secrets — optional; opaque, so only emptiness/presence matters.
  AI_GATEWAY_API_KEY: optional(z.string()),
  UPSTASH_REDIS_REST_URL: optional(z.url()),
  UPSTASH_REDIS_REST_TOKEN: optional(z.string()),
  RESEND_API_KEY: optional(z.string()),
  PSI_API_KEY: optional(z.string()),
  CRON_SECRET: optional(z.string()),
  // Kill switch: unset/empty must resolve live. No default; never an OFF keyword.
  ASK_ENABLED: optional(z.string()),
  // Privacy salt: unset/empty must stay undefined so prod auto-generates via
  // Upstash. No default; never the 'portfolio' dev fallback (lives in ip-hash).
  DEPLOY_SALT: optional(z.string()),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration (lib/env.ts):\n${details}\n` +
        'A variable is present but malformed. Fix it in .env.local (local) or ' +
        'Project Settings → Environment Variables (Vercel).',
    );
  }
  return result.data;
}

// Parsed once at module load — the fail-fast surface lives in the build log,
// not in a request trace. Frozen so the parse-once / never-mutate invariant is
// expressed in the value, not just intended.
export const env: Readonly<Env> = Object.freeze(parseEnv());
