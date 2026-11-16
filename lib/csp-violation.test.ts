import { describe, expect, it } from 'vitest';

import {
  blockedHost,
  cspDirective,
  cspDisposition,
  documentPath,
  isExtensionSource,
  MAX_FIELD_CHARS,
  UNKNOWN,
} from '@/lib/csp-violation';

describe('isExtensionSource', () => {
  it.each([
    'chrome-extension://abc/x.js',
    'moz-extension://abc',
    'safari-web-extension://abc',
    '  chrome-extension://abc',
    'EXTENSION:foo',
  ])('flags %s', (value) => {
    expect(isExtensionSource(value)).toBe(true);
  });

  it.each(['https://example.com', 'inline', '', undefined])('passes %s', (value) => {
    expect(isExtensionSource(value)).toBe(false);
  });
});

describe('blockedHost', () => {
  it('keeps only the host of a URL', () => {
    expect(blockedHost('https://cdn.example.com/a.js?q=1')).toBe('cdn.example.com');
  });

  it('falls back to the scheme when there is no host', () => {
    expect(blockedHost('data:text/plain,hi')).toBe('data');
  });

  it('keeps a bare source keyword', () => {
    expect(blockedHost('inline')).toBe('inline');
  });

  it('hides anything else', () => {
    expect(blockedHost('not a url with spaces!')).toBe(UNKNOWN);
    expect(blockedHost(undefined)).toBe(UNKNOWN);
  });

  it('caps the host length', () => {
    const host = `${'a'.repeat(MAX_FIELD_CHARS + 50)}.com`;
    expect(blockedHost(`https://${host}/`).length).toBeLessThanOrEqual(MAX_FIELD_CHARS);
  });
});

describe('documentPath', () => {
  it('returns the path of a web URL without query or hash', () => {
    expect(documentPath('https://erikunha.dev/pt?x=1#y')).toBe('/pt');
  });

  it('refuses non-web protocols and junk', () => {
    expect(documentPath('file:///etc/passwd')).toBe(UNKNOWN);
    expect(documentPath('nope')).toBe(UNKNOWN);
    expect(documentPath(undefined)).toBe(UNKNOWN);
  });

  it('caps the path length', () => {
    const path = `/${'a'.repeat(MAX_FIELD_CHARS + 50)}`;
    expect(documentPath(`https://erikunha.dev${path}`).length).toBe(MAX_FIELD_CHARS);
  });
});

describe('cspDirective', () => {
  it('accepts a directive name', () => {
    expect(cspDirective('script-src-elem')).toBe('script-src-elem');
  });

  it('rejects anything else, including a missing value', () => {
    expect(cspDirective('Script Src')).toBe(UNKNOWN);
    expect(cspDirective(undefined)).toBe(UNKNOWN);
    expect(cspDirective('a'.repeat(65))).toBe(UNKNOWN);
  });
});

describe('cspDisposition', () => {
  it('accepts the two known dispositions', () => {
    expect(cspDisposition('enforce')).toBe('enforce');
    expect(cspDisposition('report')).toBe('report');
  });

  it('maps everything else to unknown', () => {
    expect(cspDisposition('other')).toBe(UNKNOWN);
    expect(cspDisposition(undefined)).toBe(UNKNOWN);
  });
});
