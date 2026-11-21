import { vi } from 'vitest';

export { logModule, rateLimitModule } from './ask-route';

const DEFAULT_STREAM_TEXT = 'ok';
const DEFAULT_STREAM_USAGE = { inputTokens: 10, outputTokens: 1 };

type SendMock = (...args: never[]) => unknown;
type StreamUsage = Record<string, unknown>;
type StreamTextResultOptions = {
  text?: string;
  usage?: StreamUsage | Promise<StreamUsage>;
  finishReason?: string;
};

export function resendModule(send: SendMock) {
  return {
    // biome-ignore lint/complexity/useArrowFunction: `function` required, arrow fns cannot be used with `new`.
    Resend: vi.fn(function (_apiKey?: string) {
      return { emails: { send } };
    }),
  };
}

export function streamTextResult(options: StreamTextResultOptions = {}) {
  const text = options.text ?? DEFAULT_STREAM_TEXT;
  return {
    textStream: {
      async *[Symbol.asyncIterator]() {
        yield text;
      },
    },
    usage: options.usage ?? Promise.resolve(DEFAULT_STREAM_USAGE),
    ...(options.finishReason === undefined
      ? {}
      : { finishReason: Promise.resolve(options.finishReason) }),
  } as {
    textStream: AsyncIterable<string>;
    usage: StreamUsage | Promise<StreamUsage>;
    finishReason?: Promise<string>;
  };
}

export async function drain(res: Response): Promise<string> {
  return res.text();
}
