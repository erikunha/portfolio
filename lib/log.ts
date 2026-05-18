// lib/log.ts
// Structured-logging wrapper around pino.
//
// Public surface (per spec §6, GATE_RESULT: PASS):
//   - log.info(msg, ctx?)
//   - log.warn(msg, ctx?)
//   - log.error(msg, ctx?)
//
// Correlation-ID strategy: explicit-parameter passing. Each route handler
// initialises a requestId at the top (crypto.randomUUID()) and threads it
// through `log.*` ctx parameters. AsyncLocalStorage + nodejs-runtime opt-out
// was considered and rejected after architect-review — see spec §6.

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

const baseOpts = {
  level: isDev ? 'debug' : 'info',
  base: { env: process.env.NODE_ENV ?? 'unknown' },
  serializers: { err: pino.stdSerializers.err },
};
const pinoInstance = isDev
  ? pino({
      ...baseOpts,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
      },
    })
  : pino(baseOpts);

type Ctx = Record<string, unknown>;

export const log = {
  info: (msg: string, ctx?: Ctx) => pinoInstance.info(ctx, msg),
  warn: (msg: string, ctx?: Ctx) => pinoInstance.warn(ctx, msg),
  error: (msg: string, ctx?: Ctx) => pinoInstance.error(ctx, msg),
};
