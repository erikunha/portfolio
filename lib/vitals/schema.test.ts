import { describe, expect, it } from 'vitest';
import { VitalsPayload } from '@/lib/vitals/schema';

const base = { path: '/', vw: 1280, metrics: [{ name: 'CLS', value: 0.1 }] };

describe('VitalsPayload release', () => {
  it.each(['abc1234', '53c1a6f', 'a'.repeat(40)])('keeps the hex SHA %s', (release) => {
    expect(VitalsPayload.parse({ ...base, release }).release).toBe(release);
  });

  it.each(['abc123', 'a'.repeat(41), 'ABC1234', 'v1.2.3-beta', 'user@example.com', 'zzzzzzz'])(
    'drops %s instead of storing it',
    (release) => {
      expect(VitalsPayload.parse({ ...base, release }).release).toBeUndefined();
    },
  );
});
