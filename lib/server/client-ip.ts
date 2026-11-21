import { isIP } from 'node:net';

const UNKNOWN_CLIENT_IP = 'unknown';
const IPV6_GROUP_COUNT = 8;
const IPV6_PREFIX_GROUPS = 4;
const IPV6_HEX_RADIX = 16;
const IPV4_MAPPED_PREFIX = '::ffff:';
const IPV4_OCTET_BITS = 8;
const CLIENT_IP_HEADERS = ['x-vercel-forwarded-for', 'x-real-ip', 'x-forwarded-for'] as const;
const IP_KIND = { invalid: 0, v4: 4 } as const;

function ipv4ToGroups(ipv4: string): string[] {
  const [a = 0, b = 0, c = 0, d = 0] = ipv4.split('.').map(Number);
  const high = (a << IPV4_OCTET_BITS) | b;
  const low = (c << IPV4_OCTET_BITS) | d;
  return [high.toString(IPV6_HEX_RADIX), low.toString(IPV6_HEX_RADIX)];
}

function ipv6Groups(ip: string): string[] {
  const dotted = ip.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  const text = dotted ? `${dotted[1]}${ipv4ToGroups(dotted[2] ?? '').join(':')}` : ip;
  const [head = '', tail] = text.split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const missing = IPV6_GROUP_COUNT - headGroups.length - tailGroups.length;
  const fill = tail === undefined ? [] : Array<string>(missing).fill('0');
  return [...headGroups, ...fill, ...tailGroups].map((group) =>
    Number.parseInt(group, IPV6_HEX_RADIX).toString(IPV6_HEX_RADIX),
  );
}

function rateLimitBucket(ip: string): string {
  const kind = isIP(ip);
  if (kind === IP_KIND.invalid) return UNKNOWN_CLIENT_IP;
  if (kind === IP_KIND.v4) return ip;
  if (
    ip.toLowerCase().startsWith(IPV4_MAPPED_PREFIX) &&
    isIP(ip.slice(IPV4_MAPPED_PREFIX.length)) === IP_KIND.v4
  ) {
    return ip.slice(IPV4_MAPPED_PREFIX.length);
  }
  return `${ipv6Groups(ip).slice(0, IPV6_PREFIX_GROUPS).join(':')}::/64`;
}

function firstEntry(value: string | null): string {
  return value?.split(',')[0]?.trim() ?? '';
}

export function getClientIp(req: { headers: Headers }): string {
  for (const header of CLIENT_IP_HEADERS) {
    const candidate = firstEntry(req.headers.get(header));
    if (isIP(candidate) !== IP_KIND.invalid) return rateLimitBucket(candidate);
  }
  return UNKNOWN_CLIENT_IP;
}
