import 'server-only';

import pino from 'pino';

const isEdge = process.env.NEXT_RUNTIME === 'edge';

type Ctx = Record<string, unknown>;

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
