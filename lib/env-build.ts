import { z } from 'zod';

const LOCAL_SHA = 'local';

const BuildEnv = z.object({ VERCEL_GIT_COMMIT_SHA: z.string().optional() });

export function commitSha(): string {
  return BuildEnv.parse(process.env).VERCEL_GIT_COMMIT_SHA || LOCAL_SHA;
}
