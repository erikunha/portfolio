export const LOG_FIELD_MAX_CHARS = 2_000;

const UNKNOWN_ERROR_NAME = 'UnknownError';
const MAX_CLAMP_DEPTH = 4;

export interface LoggedError {
  name: string;
  message: string;
  statusCode?: number;
}

export function clampLogField(value: string): string {
  return value.length > LOG_FIELD_MAX_CHARS ? value.slice(0, LOG_FIELD_MAX_CHARS) : value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function clampValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return clampLogField(value);
  if (depth >= MAX_CLAMP_DEPTH) return value;
  if (Array.isArray(value)) return value.map((item) => clampValue(item, depth + 1));
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clampValue(item, depth + 1)]),
    );
  }
  return value;
}

export function clampLogContext(ctx: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(ctx).map(([key, value]) => [key, clampValue(value, 1)]));
}

function statusCodeOf(error: object): number | undefined {
  const { statusCode } = error as { statusCode?: unknown };
  return typeof statusCode === 'number' ? statusCode : undefined;
}

export function describeError(error: unknown): LoggedError {
  if (error instanceof Error) {
    const statusCode = statusCodeOf(error);
    return {
      name: error.name,
      message: clampLogField(error.message),
      ...(statusCode === undefined ? {} : { statusCode }),
    };
  }
  return {
    name: UNKNOWN_ERROR_NAME,
    message: clampLogField(typeof error === 'string' ? error : ''),
  };
}
