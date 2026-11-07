export const LOG_FIELD_MAX_CHARS = 2_000;

const UNKNOWN_ERROR_NAME = 'UnknownError';

export interface LoggedError {
  name: string;
  message: string;
  statusCode?: number;
}

export function clampLogField(value: string): string {
  return value.length > LOG_FIELD_MAX_CHARS ? value.slice(0, LOG_FIELD_MAX_CHARS) : value;
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
