import { describe, expect, it } from 'vitest';
import { isExpectedConsoleError } from '../../tests/e2e/_helpers/console-errors';

const DENIAL = 'Prefetch request denied: URL must be secure (HTTPS)';

describe('isExpectedConsoleError', () => {
  it('accepts the WebKit insecure-origin prefetch denial on the http test server', () => {
    expect(isExpectedConsoleError(DENIAL, 'http://localhost:3000/')).toBe(true);
    expect(isExpectedConsoleError(DENIAL, 'http://127.0.0.1:3000/cv')).toBe(true);
  });

  it('reports the same message from an https page, where a denial is a real defect', () => {
    expect(isExpectedConsoleError(DENIAL, 'https://erikunha.dev/')).toBe(false);
  });

  it('reports any other prefetch failure on the http test server', () => {
    expect(
      isExpectedConsoleError(
        'Prefetch request denied: URL is cross-origin',
        'http://localhost:3000/',
      ),
    ).toBe(false);
    expect(isExpectedConsoleError(`${DENIAL} and more`, 'http://localhost:3000/')).toBe(false);
    expect(isExpectedConsoleError(`x ${DENIAL}`, 'http://localhost:3000/')).toBe(false);
  });

  it('reports an unrelated console error', () => {
    expect(isExpectedConsoleError('Failed to load resource: 404', 'http://localhost:3000/')).toBe(
      false,
    );
  });

  it('reports a message when the page url is not parseable', () => {
    expect(isExpectedConsoleError(DENIAL, 'about:blank')).toBe(false);
    expect(isExpectedConsoleError(DENIAL, '')).toBe(false);
  });
});
