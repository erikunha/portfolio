import 'server-only';

import { z } from 'zod';

const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const EnvSchema = z.object({
  AI_GATEWAY_API_KEY: optional(z.string()),
  UPSTASH_REDIS_REST_URL: optional(z.url()),
  UPSTASH_REDIS_REST_TOKEN: optional(z.string()),
  RESEND_API_KEY: optional(z.string()),
  PSI_API_KEY: optional(z.string()),
  CRON_SECRET: optional(z.string()),
  ASK_ENABLED: optional(z.string()),
  DEPLOY_SALT: optional(z.string()),
  LANGFUSE_ENABLED: optional(z.string()),
  LANGFUSE_SECRET_KEY: optional(z.string()),
  LANGFUSE_PUBLIC_KEY: optional(z.string()),
  LANGFUSE_BASEURL: optional(z.url()),
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

export const env: Readonly<Env> = Object.freeze(parseEnv());
