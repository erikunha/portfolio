import { describe, expect, it } from 'vitest';
import { getClientIp } from '@/lib/server/client-ip';

const withHeaders = (headers: Record<string, string>) => ({ headers: new Headers(headers) });
const forwarded = (value: string) => withHeaders({ 'x-forwarded-for': value });

describe('getClientIp', () => {
  it('keeps an IPv4 address as it is', () => {
    expect(getClientIp(forwarded('203.0.113.7'))).toBe('203.0.113.7');
  });

  it('takes the first address of a forwarded chain and trims it', () => {
    expect(getClientIp(forwarded('  203.0.113.7 , 198.51.100.1'))).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    expect(getClientIp(withHeaders({ 'x-real-ip': '198.51.100.9' }))).toBe('198.51.100.9');
  });

  it('prefers x-real-ip over x-forwarded-for', () => {
    expect(
      getClientIp(withHeaders({ 'x-forwarded-for': '203.0.113.7', 'x-real-ip': '198.51.100.9' })),
    ).toBe('198.51.100.9');
  });

  it('answers unknown when no client header is present', () => {
    expect(getClientIp(withHeaders({}))).toBe('unknown');
  });

  it('sends a value that is not an IP address to the unknown bucket', () => {
    expect(getClientIp(forwarded('not-an-ip'))).toBe('unknown');
    expect(getClientIp(forwarded('1.2.3.4.5'))).toBe('unknown');
  });

  it('reduces an IPv6 address to its /64 prefix', () => {
    expect(getClientIp(forwarded('2001:db8:aaaa:bbbb:1234:5678:9abc:def0'))).toBe(
      '2001:db8:aaaa:bbbb::/64',
    );
  });

  it('normalizes letter case and leading zeros before taking the prefix', () => {
    expect(getClientIp(forwarded('2001:0DB8:00AA:BBBB::1'))).toBe('2001:db8:aa:bbbb::/64');
  });

  it('expands a compressed address before taking the prefix', () => {
    expect(getClientIp(forwarded('2001:db8::1'))).toBe('2001:db8:0:0::/64');
    expect(getClientIp(forwarded('::1'))).toBe('0:0:0:0::/64');
  });

  it('puts two addresses of one /64 in one bucket and two networks in two', () => {
    expect(getClientIp(forwarded('2001:db8:aaaa:bbbb::1'))).toBe(
      getClientIp(forwarded('2001:db8:aaaa:bbbb:ffff:ffff:ffff:ffff')),
    );
    expect(getClientIp(forwarded('2001:db8:aaaa:bbbb::1'))).not.toBe(
      getClientIp(forwarded('2001:db8:aaaa:bbbc::1')),
    );
  });

  it('maps an IPv4-mapped IPv6 address to the IPv4 address it wraps', () => {
    expect(getClientIp(forwarded('::ffff:203.0.113.7'))).toBe('203.0.113.7');
    expect(getClientIp(forwarded('::FFFF:203.0.113.7'))).toBe('203.0.113.7');
  });

  it('reads the dotted tail of an IPv6 address as two groups', () => {
    expect(getClientIp(forwarded('64:ff9b::198.51.100.1'))).toBe('64:ff9b:0:0::/64');
  });
});
