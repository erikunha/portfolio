import 'server-only';
import { z } from 'zod';
import { err } from '@/lib/server/route';

const CONTENT_LENGTH_HEADER = 'content-length';
const HTTP_STATUS = { payloadTooLarge: 413, badRequest: 400 } as const;
const ERROR_CODE = { payloadTooLarge: 'payload_too_large', invalidBody: 'invalid_body' } as const;
const ContentLengthSchema = z
  .string()
  .regex(/^\d+$/)
  .transform((value) => Number(value));

type Handler = (req: Request) => Promise<Response>;

function bodyTooLarge(maxBytes: number): Response {
  return err({
    requestId: crypto.randomUUID(),
    status: HTTP_STATUS.payloadTooLarge,
    code: ERROR_CODE.payloadTooLarge,
    message: `request body exceeds the ${maxBytes}-byte limit`,
  });
}

export function withBodyLimit(handler: Handler, maxBytes: number): Handler {
  return async (req) => {
    const contentLength = ContentLengthSchema.safeParse(req.headers.get(CONTENT_LENGTH_HEADER));
    if (contentLength.success && contentLength.data > maxBytes) return bodyTooLarge(maxBytes);
    if (!req.body) return handler(req);

    const reader = req.body.getReader();
    const bytes = new Uint8Array(maxBytes);
    let byteLength = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        byteLength += value.byteLength;
        if (byteLength > maxBytes) {
          await reader.cancel().catch(() => undefined);
          return bodyTooLarge(maxBytes);
        }
        bytes.set(value, byteLength - value.byteLength);
      }
    } catch {
      return err({
        requestId: crypto.randomUUID(),
        status: HTTP_STATUS.badRequest,
        code: ERROR_CODE.invalidBody,
        message: 'request body could not be read',
      });
    } finally {
      reader.releaseLock();
    }

    const headers = new Headers(req.headers);
    headers.set(CONTENT_LENGTH_HEADER, String(byteLength));
    return handler(new Request(req, { headers, body: bytes.subarray(0, byteLength) }));
  };
}
