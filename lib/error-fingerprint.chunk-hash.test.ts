import { describe, expect, it } from 'vitest';
import { errorFingerprint } from '@/lib/error-fingerprint';

const HOST = 'https://erikunha.dev';

function stackOf(file: string): string {
  return [
    'TypeError: x is undefined',
    `    at render (${HOST}/${file}:10:20)`,
    `    at update (${HOST}/${file}:30:40)`,
  ].join('\n');
}

function safariStackOf(file: string): string {
  return `render@${HOST}/${file}:1:2\nupdate@${HOST}/${file}:3:4`;
}

const hashedPairs = [
  ['dash hash', '_next/static/chunks/app-4f3a9c2b1d.js', '_next/static/chunks/app-9a8b7c6d5e.js'],
  ['dot hash', '_next/static/chunks/app.4f3a9c2b1d.js', '_next/static/chunks/app.9a8b7c6d5e.js'],
  [
    'whole-name hash',
    '_next/static/chunks/4f3a9c2b1d7e8f90.js',
    '_next/static/chunks/9a8b7c6d5e0f1a2b.js',
  ],
  [
    'numbered chunk with hash',
    '_next/static/chunks/1234-4f3a9c2b1d7e8f90.js',
    '_next/static/chunks/1234-9a8b7c6d5e0f1a2b.js',
  ],
  [
    'mixed-case hash',
    '_next/static/chunks/webpack-Ab12Cd34Ef56.js',
    '_next/static/chunks/webpack-Zy98Xw76Vu54.js',
  ],
  [
    'underscore hash',
    '_next/static/chunks/_4f3a9c2b1d7e._.js',
    '_next/static/chunks/_9a8b7c6d5e0f._.js',
  ],
] as const;

describe('errorFingerprint across deploys', () => {
  it.each(hashedPairs)(
    'is stable when only the chunk hash changes (%s)',
    (_name, before, after) => {
      expect(errorFingerprint({ message: 'm', stack: stackOf(before) })).toBe(
        errorFingerprint({ message: 'm', stack: stackOf(after) }),
      );
    },
  );

  it.each(hashedPairs)(
    'is stable for Safari and Firefox frames when only the chunk hash changes (%s)',
    (_name, before, after) => {
      expect(errorFingerprint({ message: 'm', stack: safariStackOf(before) })).toBe(
        errorFingerprint({ message: 'm', stack: safariStackOf(after) }),
      );
    },
  );

  it('still separates two different chunks that share a hash length', () => {
    expect(
      errorFingerprint({ message: 'm', stack: stackOf('_next/static/chunks/app-4f3a9c2b1d.js') }),
    ).not.toBe(
      errorFingerprint({ message: 'm', stack: stackOf('_next/static/chunks/main-4f3a9c2b1d.js') }),
    );
  });

  it('still separates two different unhashed files', () => {
    expect(errorFingerprint({ message: 'm', stack: stackOf('static/vendor.js') })).not.toBe(
      errorFingerprint({ message: 'm', stack: stackOf('static/ventor.js') }),
    );
  });

  it('keeps short numeric chunk ids distinct', () => {
    expect(
      errorFingerprint({ message: 'm', stack: stackOf('_next/static/chunks/1234.js') }),
    ).not.toBe(errorFingerprint({ message: 'm', stack: stackOf('_next/static/chunks/5678.js') }));
  });
});
