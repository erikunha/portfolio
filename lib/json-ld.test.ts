import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from './json-ld';

describe('serializeJsonLd', () => {
  it('escapes a closing script tag so a value cannot end the script element', () => {
    const out = serializeJsonLd({ name: '</script><img src=x onerror=alert(1)>' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out)).toEqual({ name: '</script><img src=x onerror=alert(1)>' });
  });

  it('escapes the line separators that break script parsing in older engines', () => {
    const out = serializeJsonLd({ name: 'a\u2028b\u2029c' });
    expect(out).not.toMatch(/[\u2028\u2029]/);
    expect(JSON.parse(out).name).toBe('a\u2028b\u2029c');
  });

  it('leaves a plain document identical to JSON.stringify', () => {
    const value = { '@type': 'Person', name: 'Erik' };
    expect(serializeJsonLd(value)).toBe(JSON.stringify(value));
  });
});
