import { describe, expect, it } from 'vitest';
import { getClientIp } from '@/lib/server/client-ip';

const withHeaders = (headers: Record<string, string>) => ({ headers: new Headers(headers) });

const PLATFORM_IP = '203.0.113.1';
const REAL_IP = '203.0.113.2';
const FORWARDED_IP = '203.0.113.3';

describe('getClientIp header order', () => {
  it('lets the platform header win over a spoofed x-forwarded-for and x-real-ip', () => {
    expect(
      getClientIp(
        withHeaders({
          'x-vercel-forwarded-for': PLATFORM_IP,
          'x-real-ip': REAL_IP,
          'x-forwarded-for': `${FORWARDED_IP}, 198.51.100.50`,
        }),
      ),
    ).toBe(PLATFORM_IP);
  });

  it('reads x-real-ip second when the platform header is absent', () => {
    expect(
      getClientIp(withHeaders({ 'x-real-ip': REAL_IP, 'x-forwarded-for': FORWARDED_IP })),
    ).toBe(REAL_IP);
  });

  it('reads the first x-forwarded-for entry third', () => {
    expect(getClientIp(withHeaders({ 'x-forwarded-for': ` ${FORWARDED_IP} , ${REAL_IP}` }))).toBe(
      FORWARDED_IP,
    );
  });

  it('skips an invalid platform header and uses the next valid candidate', () => {
    expect(
      getClientIp(
        withHeaders({
          'x-vercel-forwarded-for': 'not-an-ip',
          'x-real-ip': '1.2.3.4.5',
          'x-forwarded-for': FORWARDED_IP,
        }),
      ),
    ).toBe(FORWARDED_IP);
  });

  it('buckets an IPv6 platform header to its /64', () => {
    expect(
      getClientIp(
        withHeaders({
          'x-vercel-forwarded-for': '2001:db8:aaaa:bbbb::1',
          'x-forwarded-for': FORWARDED_IP,
        }),
      ),
    ).toBe('2001:db8:aaaa:bbbb::/64');
  });

  it('answers unknown when no header holds a valid address', () => {
    expect(
      getClientIp(withHeaders({ 'x-vercel-forwarded-for': 'x', 'x-forwarded-for': 'y' })),
    ).toBe('unknown');
  });
});
