import 'server-only';

import pino from 'pino';
import { clampLogContext } from '@/lib/log-error';

// biome-ignore lint/style/noProcessEnv: the logger also runs on the edge runtime and must not import the validated env module, so it reads the runtime flags Next provides directly
const isEdge = process.env.NEXT_RUNTIME === 'edge';

const PRETTY_OUTPUT_ENV = 'development';

type Ctx = Record<string, unknown>;

function edgeLog(level: 'info' | 'warn' | 'error', msg: string, ctx?: Ctx): void {
  console.log(
    JSON.stringify({
      level,
      msg,
      ts: new Date().toISOString(),
      // biome-ignore lint/style/noProcessEnv: the logger also runs on the edge runtime and must not import the validated env module, so it reads the runtime flags Next provides directly
      env: process.env.NODE_ENV,
      ...(ctx && clampLogContext(ctx)),
    }),
  );
}

let pinoInstance: pino.Logger | null = null;

if (!isEdge) {
  // biome-ignore lint/style/noProcessEnv: the logger also runs on the edge runtime and must not import the validated env module, so it reads the runtime flags Next provides directly
  const isDev = process.env.NODE_ENV !== 'production';
  // biome-ignore lint/style/noProcessEnv: the logger also runs on the edge runtime and must not import the validated env module, so it reads the runtime flags Next provides directly
  const prettyOutput = process.env.NODE_ENV === PRETTY_OUTPUT_ENV;
  const baseOpts = {
    level: isDev ? 'debug' : 'info',
    // biome-ignore lint/style/noProcessEnv: the logger also runs on the edge runtime and must not import the validated env module, so it reads the runtime flags Next provides directly
    base: { env: process.env.NODE_ENV ?? 'unknown' },
    serializers: { err: pino.stdSerializers.err },
  };
  pinoInstance = prettyOutput
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
      ctx ? pinoInstance.info(clampLogContext(ctx), msg) : pinoInstance.info(msg);
    } else {
      edgeLog('info', msg, ctx);
    }
  },
  warn: (msg: string, ctx?: Ctx) => {
    if (pinoInstance) {
      ctx ? pinoInstance.warn(clampLogContext(ctx), msg) : pinoInstance.warn(msg);
    } else {
      edgeLog('warn', msg, ctx);
    }
  },
  error: (msg: string, ctx?: Ctx) => {
    if (pinoInstance) {
      ctx ? pinoInstance.error(clampLogContext(ctx), msg) : pinoInstance.error(msg);
    } else {
      edgeLog('error', msg, ctx);
    }
  },
};
