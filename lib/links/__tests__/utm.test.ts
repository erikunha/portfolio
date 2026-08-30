import { describe, expect, it } from 'vitest';
import { withUtm } from '@/lib/links/utm';

describe('withUtm', () => {
  it('appends the bio source and the content slug to a bare url', () => {
    expect(withUtm('https://youtube.com/@erik', 'inscrever')).toBe(
      'https://youtube.com/@erik?utm_source=bio&utm_content=inscrever',
    );
  });

  it('merges into an existing query string instead of replacing it', () => {
    const out = new URL(withUtm('https://youtube.com/watch?v=abc', 'ultimo-video'));
    expect(out.searchParams.get('v')).toBe('abc');
    expect(out.searchParams.get('utm_source')).toBe('bio');
    expect(out.searchParams.get('utm_content')).toBe('ultimo-video');
  });

  it('overwrites a stale utm_content rather than appending a second one', () => {
    const out = new URL(withUtm('https://example.com/?utm_content=old', 'novo'));
    expect(out.searchParams.getAll('utm_content')).toEqual(['novo']);
  });

  it('leaves a mailto link untouched — utm on mailto is a broken address', () => {
    expect(withUtm('mailto:erik@example.com', 'email')).toBe('mailto:erik@example.com');
  });

  it('leaves a same-page fragment untouched', () => {
    expect(withUtm('#qr', 'qr')).toBe('#qr');
  });

  it('preserves the hash of an external url', () => {
    expect(withUtm('https://example.com/p#section', 'x')).toBe(
      'https://example.com/p?utm_source=bio&utm_content=x#section',
    );
  });
});
