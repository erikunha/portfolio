import { HIRING_PROFILE } from '@/lib/hiring-profile';

export async function GET(): Promise<Response> {
  return Response.json(HIRING_PROFILE, {
    headers: {
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
