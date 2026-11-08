import { activeGroupIds, installCleanup, runProcess } from '../../lib/ci-predict-process';

const REPORT_AFTER_MS = 300;
const HOLD_OPEN_MS = 60_000;
const LONG_SLEEP_SECONDS = '300';

installCleanup(() => undefined);
void runProcess('sleep', [LONG_SLEEP_SECONDS], {
  cwd: process.cwd(),
  env: {},
  logPath: process.argv[2] ?? '/dev/null',
});
setTimeout(
  () => process.stdout.write(`group ${[...activeGroupIds()].join(',')}\n`),
  REPORT_AFTER_MS,
);
setTimeout(() => undefined, HOLD_OPEN_MS);
