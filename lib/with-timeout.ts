export const SSR_REDIS_TIMEOUT_MS = 3_000;

export class ReadTimeoutError extends Error {
  constructor() {
    super('Redis read timed out');
    this.name = 'ReadTimeoutError';
  }
}

export async function withTimeout<T>(read: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(read),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ReadTimeoutError()), SSR_REDIS_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
