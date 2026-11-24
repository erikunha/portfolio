import { isoWeek } from '@/lib/time';

const WEEK_PATTERN = /^\d{4}-W\d{2}$/;

export interface ReportArgs {
  week: string;
  release?: string;
  route?: string;
  json: boolean;
}

export type ParsedReportArgs = { ok: true; args: ReportArgs } | { ok: false; message: string };

export function parseReportArgs(argv: readonly string[], now: Date): ParsedReportArgs {
  let week = isoWeek(now);
  let release: string | undefined;
  let route: string | undefined;
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--json') {
      json = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      return { ok: false, message: `${flag} needs a value` };
    }
    index += 1;
    if (flag === '--week') {
      if (!WEEK_PATTERN.test(value)) return { ok: false, message: '--week looks like 2026-W48' };
      week = value;
    } else if (flag === '--release') release = value;
    else if (flag === '--route') route = value;
    else return { ok: false, message: `unknown argument ${flag}` };
  }
  return {
    ok: true,
    args: {
      week,
      json,
      ...(release === undefined ? {} : { release }),
      ...(route === undefined ? {} : { route }),
    },
  };
}
