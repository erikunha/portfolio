import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { createServer } from 'node:http';

const [, self = '', role = '', pidFile = ''] = process.argv;
const KEEP_ALIVE_MS = 60_000;

if (role === 'child') {
  process.on('SIGTERM', () => undefined);
  appendFileSync(pidFile, `${process.pid}\n`);
  const port = Number(process.env.PORT);
  if (Number.isInteger(port) && port > 0) createServer((_, res) => res.end('ok')).listen(port);
  setInterval(() => undefined, KEEP_ALIVE_MS);
} else {
  spawn(process.execPath, [self, 'child', pidFile], { stdio: 'inherit' });
  process.on('SIGTERM', () => process.exit(0));
  setInterval(() => undefined, KEEP_ALIVE_MS);
}
