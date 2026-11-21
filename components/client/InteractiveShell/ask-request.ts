import type { SiteLocale } from '@/content/site-locale';
import { SITE_LOCALE_HEADER } from '@/lib/stream-protocol';

const ASK_ENDPOINT = '/api/ask';

type AskRequestParams = { question: string; locale: SiteLocale; conversationId: string };

export type AskRequest = {
  send: () => Promise<Response>;
  openReader: (response: Response) => ReadableStreamDefaultReader<Uint8Array> | undefined;
  abort: () => void;
  readonly aborted: boolean;
};

export function createAskRequest({
  question,
  locale,
  conversationId,
}: AskRequestParams): AskRequest {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  return {
    send: () =>
      fetch(ASK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [SITE_LOCALE_HEADER]: locale },
        body: JSON.stringify({ question, locale, conversationId }),
        signal: controller.signal,
      }),
    openReader: (response) => {
      reader = response.body?.getReader();
      return reader;
    },
    abort: () => {
      if (controller.signal.aborted) return;
      controller.abort();
      void reader?.cancel().catch(() => undefined);
    },
    get aborted() {
      return controller.signal.aborted;
    },
  };
}
