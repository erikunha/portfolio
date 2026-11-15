import { social } from '@/content/social';
import { startAsk } from '@/lib/ask/stream';
import { parseStreamChunk, REFUSAL_PREFIX, REQUEST_ID_HEADER } from '@/lib/stream-protocol';

const FORWARDED_CLIENT_HEADERS = ['x-forwarded-for', 'x-real-ip'] as const;

const ASK_ROUTE_URL = `${social.site}/api/ask`;

const EMPTY_ANSWER = '(empty answer)';

export type AskOnceOutcome = { ok: boolean; text: string; requestId: string | null };

function clientRequest(question: string, clientHeaders: Headers | undefined): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  for (const name of FORWARDED_CLIENT_HEADERS) {
    const value = clientHeaders?.get(name);
    if (value) headers.set(name, value);
  }
  return new Request(ASK_ROUTE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ question }),
  });
}

async function refusalText(response: Response): Promise<string> {
  const fallback = `ask endpoint returned ${response.status}`;
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : fallback;
  } catch {
    return fallback;
  }
}

function answerOutcome(raw: string): Omit<AskOnceOutcome, 'requestId'> {
  const chunk = parseStreamChunk(raw);
  if (chunk.ok) return { ok: true, text: chunk.displayText || EMPTY_ANSWER };
  if (chunk.errorMessage.startsWith(REFUSAL_PREFIX)) {
    const refusal = chunk.errorMessage.slice(REFUSAL_PREFIX.length);
    return { ok: true, text: chunk.displayText ? `${chunk.displayText}\n\n${refusal}` : refusal };
  }
  const text = chunk.displayText
    ? `${chunk.displayText}\n\n[upstream error: ${chunk.errorMessage}]`
    : `error: ${chunk.errorMessage}`;
  return { ok: false, text };
}

export async function askOnce(
  question: string,
  clientHeaders: Headers | undefined,
): Promise<AskOnceOutcome> {
  const start = await startAsk(clientRequest(question, clientHeaders));
  if (!start.ok) {
    return {
      ok: false,
      text: await refusalText(start.response),
      requestId: start.response.headers.get(REQUEST_ID_HEADER),
    };
  }
  const raw = await new Response(start.readable).text();
  return { ...answerOutcome(raw), requestId: start.requestId };
}
