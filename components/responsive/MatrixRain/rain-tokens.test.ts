import { describe, expect, it } from 'vitest';
import { getThemeColors } from '../../../app/(en)/design-system/_lib/theme-tokens';
import {
  RAIN_BODY_COLOR,
  RAIN_CANVAS_BLACK,
  RAIN_DESKTOP_PROFILE,
  RAIN_FONT_FAMILY,
  RAIN_HEAD_COLOR,
  RAIN_MOBILE_PROFILE,
  RAIN_TAIL_FADE,
  rainFont,
} from './rain-tokens';
import { scaleTailFade } from './tail-fade';

const SHORT_HEX = /^#([\da-f])([\da-f])([\da-f])$/i;

const expandHex = (hex: string) => hex.replace(SHORT_HEX, '#$1$1$2$2$3$3').toLowerCase();

describe('rain tokens', () => {
  it('keep the colours and sizes the rain shipped with', () => {
    expect(RAIN_HEAD_COLOR).toBe('#1d6a2a');
    expect(RAIN_BODY_COLOR).toBe('#072810');
    expect(RAIN_TAIL_FADE).toBe('rgba(0,0,0,0.10)');
    expect(RAIN_CANVAS_BLACK).toBe('#000');
    expect(RAIN_DESKTOP_PROFILE).toEqual({ fontSize: 16, speed: 0.7, opacity: 0.28 });
    expect(RAIN_MOBILE_PROFILE).toEqual({ fontSize: 14, speed: 0.6, opacity: 0.22 });
    expect(rainFont(16)).toBe('16px "JetBrains Mono", monospace');
    expect(RAIN_FONT_FAMILY).toBe('"JetBrains Mono", monospace');
  });

  it('the canvas black is the theme pure black', () => {
    expect(
      expandHex(RAIN_CANVAS_BLACK),
      'the rain canvas black drifted from --color-secondary-950 in app/css/theme.css; change one source and the other with it',
    ).toBe(getThemeColors()['secondary-950']);
  });

  it('the tail fade stays in the alpha form scaleTailFade rewrites', () => {
    const scaled = scaleTailFade(RAIN_TAIL_FADE, 2);
    expect(
      scaled,
      'scaleTailFade returns its input unchanged when the fade does not match its rgba pattern, so the frame governor would stop thinning the tail',
    ).not.toBe(RAIN_TAIL_FADE);
    expect(scaled).toBe('rgba(0,0,0,0.19)');
  });
});
