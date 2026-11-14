import { HTTP_STATUS } from '@/lib/http-status';

export async function POST(): Promise<Response> {
  return new Response(null, { status: HTTP_STATUS.noContent });
}
