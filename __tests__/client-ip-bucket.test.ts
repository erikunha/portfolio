import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@upstash/redis', () => ({ Redis: { fromEnv: vi.fn() } }));
vi.mock('@upstash/ratelimit', () => ({ Ratelimit: class {} }));
vi.mock('@/lib/log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const forwarded = (value: string) =>
  new NextRequest('http://localhost/api/contact', { headers: { 'x-forwarded-for': value } });

describe('getClientIp rate-limit bucket', () => {
  it('puts every address of one IPv6 /64 in the same bucket so rotating the host part cannot reset a limit', async () => {
    const { getClientIp } = await import('@/lib/rate-limit');
    const first = getClientIp(forwarded('2001:db8:aaaa:bbbb::1'));
    const second = getClientIp(forwarded('2001:DB8:AAAA:BBBB:1234:5678:9abc:def0'));
    expect(second).toBe(first);
  });

  it('keeps two different IPv6 /64 networks in different buckets', async () => {
    const { getClientIp } = await import('@/lib/rate-limit');
    expect(getClientIp(forwarded('2001:db8:aaaa:bbbb::1'))).not.toBe(
      getClientIp(forwarded('2001:db8:aaaa:bbbc::1')),
    );
  });

  it('expands a compressed address before taking the /64 prefix', async () => {
    const { getClientIp } = await import('@/lib/rate-limit');
    expect(getClientIp(forwarded('2001:db8::1'))).toBe(
      getClientIp(forwarded('2001:0db8:0000:0000:ffff:ffff:ffff:ffff')),
    );
  });

  it('treats an IPv4-mapped IPv6 address as the IPv4 address it wraps', async () => {
    const { getClientIp } = await import('@/lib/rate-limit');
    expect(getClientIp(forwarded('::ffff:203.0.113.7'))).toBe('203.0.113.7');
  });

  it('leaves IPv4 untouched', async () => {
    const { getClientIp } = await import('@/lib/rate-limit');
    expect(getClientIp(forwarded('203.0.113.7'))).toBe('203.0.113.7');
  });

  it('sends a header value that is not an IP address to the shared unknown bucket', async () => {
    const { getClientIp } = await import('@/lib/rate-limit');
    expect(getClientIp(forwarded('not-an-ip'))).toBe('unknown');
    expect(getClientIp(forwarded('1.2.3.4.5'))).toBe('unknown');
  });
});
