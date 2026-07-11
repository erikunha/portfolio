import 'server-only';
import { headers } from 'next/headers';

export async function getIsMobile(): Promise<boolean> {
  const ua = (await headers()).get('user-agent') ?? '';
  return /Mobile|Android/i.test(ua);
}
