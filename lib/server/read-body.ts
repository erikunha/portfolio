import 'server-only';
import { z } from 'zod';

const CONTENT_LENGTH_HEADER = 'content-length';

export const BODY_REJECTION = {
  payloadTooLarge: { status: 413, code: 'payload_too_large' },
  unreadable: { status: 400, code: 'invalid_body' },
} as const;

const ContentLengthSchema = z
  .string()
  .regex(/^\d+$/)
  .transform((value) => Number(value));

export type BoundedBody =
  | { ok: true; bytes: Uint8Array<ArrayBuffer> | null }
  | { ok: false; status: number; code: string; message: string };

function tooLarge(maxBytes: number): BoundedBody {
  return {
    ok: false,
    ...BODY_REJECTION.payloadTooLarge,
    message: `request body exceeds the ${maxBytes}-byte limit`,
  };
}

export async function readBoundedBody(
  req: { headers: Headers; body: ReadableStream<Uint8Array> | null },
  maxBytes: number,
): Promise<BoundedBody> {
  const contentLength = ContentLengthSchema.safeParse(req.headers.get(CONTENT_LENGTH_HEADER));
  if (contentLength.success && contentLength.data > maxBytes) return tooLarge(maxBytes);
  if (!req.body) return { ok: true, bytes: null };

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
        return tooLarge(maxBytes);
      }
      bytes.set(value, byteLength - value.byteLength);
    }
  } catch {
    return {
      ok: false,
      ...BODY_REJECTION.unreadable,
      message: 'request body could not be read',
    };
  } finally {
    reader.releaseLock();
  }
  return { ok: true, bytes: bytes.subarray(0, byteLength) };
}
