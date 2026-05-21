import 'server-only';
import { headers } from 'next/headers';

// UA heuristic: can disagree with actual viewport (e.g. small desktop window, iPad in desktop mode).
export async function getIsMobile(): Promise<boolean> {
  const ua = (await headers()).get('user-agent') ?? '';
  return /Mobile|Android/i.test(ua);
}
