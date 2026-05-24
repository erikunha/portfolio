// __tests__/breakpoint.test.ts
// Behavioral tests for lib/breakpoint.ts.
// Locks down: MOBILE_BREAKPOINT_PX value; detectMobileFromUA returns false for
// null/undefined/desktop UAs and true for mobile UAs matching the regex.

import { describe, expect, it } from 'vitest';
import { detectMobileFromUA, MOBILE_BREAKPOINT_PX } from '@/lib/breakpoint';

describe('MOBILE_BREAKPOINT_PX', () => {
  it('equals 768', () => {
    expect(MOBILE_BREAKPOINT_PX).toBe(768);
  });
});

describe('detectMobileFromUA', () => {
  it('returns false for null', () => {
    expect(detectMobileFromUA(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(detectMobileFromUA(undefined)).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(detectMobileFromUA('')).toBe(false);
  });

  it('returns false for a desktop Chrome UA', () => {
    expect(
      detectMobileFromUA(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      ),
    ).toBe(false);
  });

  it('returns true for an iPhone Safari UA', () => {
    expect(
      detectMobileFromUA(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(true);
  });

  it('returns true for an Android Chrome UA', () => {
    expect(
      detectMobileFromUA(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/125.0 Mobile Safari/537.36',
      ),
    ).toBe(true);
  });

  it('returns true for a BlackBerry UA', () => {
    expect(detectMobileFromUA('BlackBerry9700')).toBe(true);
  });

  it('returns true for an iPad UA with Tablet in the string', () => {
    expect(detectMobileFromUA('Some Tablet Browser')).toBe(true);
  });
});
