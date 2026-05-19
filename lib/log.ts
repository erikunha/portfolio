import 'server-only';

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
//
// Edge-runtime guard: pino requires Node worker_threads (via thread-stream /
// pino-pretty). If this module were ever imported from an Edge-runtime path
// the build would either fail or silently strip the transport. We detect the
// Edge runtime via NEXT_RUNTIME=edge (set by Next.js during Edge bundling)
// and fall back to a console.log JSON shim with the same {info, warn, error}
// surface so consumers are unchanged.

import pino from 'pino';

// NEXT_RUNTIME is injected by Next.js at build/runtime time.
// 'edge' = Vercel Edge runtime (no Node worker_threads).
// 'nodejs' or undefined = standard Node.js Lambda runtime.
const isEdge = process.env.NEXT_RUNTIME === 'edge';

type Ctx = Record<string, unknown>;

// Minimal JSON shim used when pino is unavailable (Edge runtime).
function edgeLog(level: 'info' | 'warn' | 'error', msg: string, ctx?: Ctx): void {
  console.log(
    JSON.stringify({ level, msg, ts: new Date().toISOString(), env: process.env.NODE_ENV, ...ctx }),
  );
}

let pinoInstance: pino.Logger | null = null;

if (!isEdge) {
  const isDev = process.env.NODE_ENV !== 'production';
  const baseOpts = {
    level: isDev ? 'debug' : 'info',
    base: { env: process.env.NODE_ENV ?? 'unknown' },
    serializers: { err: pino.stdSerializers.err },
  };
  pinoInstance = isDev
    ? pino({
        ...baseOpts,
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
        },
      })
    : pino(baseOpts);
}

export const log = {
  info: (msg: string, ctx?: Ctx) => {
    if (pinoInstance) {
      ctx ? pinoInstance.info(ctx, msg) : pinoInstance.info(msg);
    } else {
      edgeLog('info', msg, ctx);
    }
  },
  warn: (msg: string, ctx?: Ctx) => {
    if (pinoInstance) {
      ctx ? pinoInstance.warn(ctx, msg) : pinoInstance.warn(msg);
    } else {
      edgeLog('warn', msg, ctx);
    }
  },
  error: (msg: string, ctx?: Ctx) => {
    if (pinoInstance) {
      ctx ? pinoInstance.error(ctx, msg) : pinoInstance.error(msg);
    } else {
      edgeLog('error', msg, ctx);
    }
  },
};
