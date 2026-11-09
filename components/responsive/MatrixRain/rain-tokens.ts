export const RAIN_FONT_FAMILY = '"JetBrains Mono", monospace';

export const RAIN_DESKTOP_PROFILE = { fontSize: 16, speed: 0.7, opacity: 0.28 } as const;
export const RAIN_MOBILE_PROFILE = { fontSize: 14, speed: 0.6, opacity: 0.22 } as const;

export const RAIN_HEAD_PROPERTY = '--color-rain-head';
export const RAIN_BODY_PROPERTY = '--color-rain-body';
export const RAIN_CANVAS_PROPERTY = '--color-secondary-950';
export const RAIN_TAIL_ALPHA_PROPERTY = '--rain-tail-alpha';

const HEX_CHANNELS = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i;
const SHORT_HEX = /^#([\da-f])([\da-f])([\da-f])$/i;
const HEX_RADIX = 16;

export type RainPalette = {
  head: string;
  body: string;
  canvasBlack: string;
  tailFade: string;
};

export const rainFont = (fontSize: number) => `${fontSize}px ${RAIN_FONT_FAMILY}`;

function readToken(style: CSSStyleDeclaration, property: string): string {
  const value = style.getPropertyValue(property).trim();
  if (value === '') throw new Error(`MatrixRain needs ${property} from app/css/theme.css`);
  return value;
}

function tailFadeFrom(canvasBlack: string, alpha: string): string {
  const full = canvasBlack.replace(SHORT_HEX, '#$1$1$2$2$3$3');
  const channels = HEX_CHANNELS.exec(full)?.slice(1) ?? [];
  if (channels.length === 0) {
    throw new Error(`${RAIN_CANVAS_PROPERTY} must resolve to a 3- or 6-digit hex color`);
  }
  const [red, green, blue] = channels.map((channel) => Number.parseInt(channel, HEX_RADIX));
  return `rgba(${red},${green},${blue},${alpha})`;
}

export function readRainPalette(style: CSSStyleDeclaration): RainPalette {
  const canvasBlack = readToken(style, RAIN_CANVAS_PROPERTY);
  return {
    head: readToken(style, RAIN_HEAD_PROPERTY),
    body: readToken(style, RAIN_BODY_PROPERTY),
    canvasBlack,
    tailFade: tailFadeFrom(canvasBlack, readToken(style, RAIN_TAIL_ALPHA_PROPERTY)),
  };
}
