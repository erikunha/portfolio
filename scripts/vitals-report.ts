#!/usr/bin/env tsx

import { getRedis, hasRedisCredentials } from '@/lib/redis';
import { formatVitals, summarizeVitals } from '@/lib/vitals/aggregate';
import { parseReportArgs } from '@/lib/vitals/report-args';
import { vitalsKey } from '@/lib/vitals/store';

const EXIT_BAD_ARGUMENTS = 2;
const EXIT_NO_CREDENTIALS = 3;

async function main(): Promise<void> {
  const parsed = parseReportArgs(process.argv.slice(2), new Date());
  if (!parsed.ok) {
    console.error(
      `${parsed.message}\nusage: pnpm vitals:report [--week 2026-W48] [--release <sha>] [--route home] [--json]`,
    );
    process.exitCode = EXIT_BAD_ARGUMENTS;
    return;
  }
  if (!hasRedisCredentials()) {
    console.error(
      'Redis credentials are not set (UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or KV_REST_API_URL and KV_REST_API_TOKEN)',
    );
    process.exitCode = EXIT_NO_CREDENTIALS;
    return;
  }
  const { week, release, route, json } = parsed.args;
  const raw = await getRedis().lrange(vitalsKey(week), 0, -1);
  const groups = summarizeVitals(raw).filter(
    (group) =>
      (release === undefined || group.release === release) &&
      (route === undefined || group.route === route),
  );
  console.log(
    json
      ? JSON.stringify(groups, null, 2)
      : `${week}, ${raw.length} records\n${formatVitals(groups)}`,
  );
}

await main();
