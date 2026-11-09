import { describe, expect, it } from 'vitest';
import {
  RAIN_DESKTOP_PROFILE,
  RAIN_FONT_FAMILY,
  RAIN_MOBILE_PROFILE,
  rainFont,
} from './rain-tokens';

describe('rain tokens', () => {
  it('keep the sizes the rain shipped with', () => {
    expect(RAIN_DESKTOP_PROFILE).toEqual({ fontSize: 16, speed: 0.7, opacity: 0.28 });
    expect(RAIN_MOBILE_PROFILE).toEqual({ fontSize: 14, speed: 0.6, opacity: 0.22 });
    expect(rainFont(16)).toBe('16px "JetBrains Mono", monospace');
    expect(RAIN_FONT_FAMILY).toBe('"JetBrains Mono", monospace');
  });
});
