import { describe, expect, it } from 'vitest';
import { HTTP_STATUS } from './http-status';

describe('HTTP_STATUS', () => {
  it.each([
    ['ok', 200],
    ['accepted', 202],
    ['noContent', 204],
    ['badRequest', 400],
    ['unauthorized', 401],
    ['forbidden', 403],
    ['payloadTooLarge', 413],
    ['tooManyRequests', 429],
    ['internalServerError', 500],
    ['badGateway', 502],
    ['serviceUnavailable', 503],
  ] as const)('%s is %i', (name, code) => {
    expect(HTTP_STATUS[name]).toBe(code);
  });

  it('gives every name its own code', () => {
    const codes = Object.values(HTTP_STATUS);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
