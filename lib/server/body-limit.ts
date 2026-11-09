import 'server-only';
import { NextRequest } from 'next/server';
import { readBoundedBody } from '@/lib/server/read-body';
import { err } from '@/lib/server/route';

const CONTENT_LENGTH_HEADER = 'content-length';

type Handler = (req: NextRequest) => Promise<Response>;

const rebuild = (req: Request, init: Pick<RequestInit, 'headers' | 'body'>) =>
  new NextRequest(req.url, { method: req.method, ...init });

const asNextRequest = (req: Request) =>
  req instanceof NextRequest ? req : rebuild(req, { headers: new Headers(req.headers) });

export function withBodyLimit(
  handler: Handler,
  maxBytes: number,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const body = await readBoundedBody(req, maxBytes);
    if (!body.ok) {
      return err({
        requestId: crypto.randomUUID(),
        status: body.status,
        code: body.code,
        message: body.message,
      });
    }
    if (body.bytes === null) return handler(asNextRequest(req));

    const headers = new Headers(req.headers);
    headers.set(CONTENT_LENGTH_HEADER, String(body.bytes.byteLength));
    return handler(rebuild(req, { headers, body: body.bytes }));
  };
}
