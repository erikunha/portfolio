type PostJsonOptions = {
  headers?: Record<string, string>;
  timeoutMs: number;
};

export type PostJsonResult<T> = { response: Response; data: T | null };

export async function postJson<T>(
  url: string,
  body: unknown,
  { headers, timeoutMs }: PostJsonOptions,
): Promise<PostJsonResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => null)) as T | null;
    return { response, data };
  } finally {
    clearTimeout(timer);
  }
}
