/**
 * Design Tokens TypeScript Definitions
 * Type-safe access to all design tokens
 * Auto-generated from CSS custom properties
 *
 * @packageDocumentation
 */

/* ========================================
   COLOR TOKENS
   ======================================== */

export type ColorToken =
  | 'brand-primary'
  | 'brand-primary-hover'
  | 'brand-primary-active'
  | 'brand-primary-dim'
  | 'brand-secondary'
  | 'brand-secondary-hover'
  | 'brand-secondary-active'
  | 'neutral-0'
  | 'neutral-50'
  | 'neutral-100'
  | 'neutral-200'
  | 'neutral-300'
  | 'neutral-400'
  | 'neutral-500'
  | 'neutral-600'
  | 'neutral-700'
  | 'neutral-800'
  | 'neutral-900'
  | 'neutral-1000'
  | 'success'
  | 'success-bg'
  | 'success-border'
  | 'warning'
  | 'warning-bg'
  | 'warning-border'
  | 'error'
  | 'error-bg'
  | 'error-border'
  | 'info'
  | 'info-bg'
  | 'info-border'
  | 'background'
  | 'background-elevated'
  | 'background-overlay'
  | 'surface'
  | 'border'
  | 'border-strong'
  | 'text-primary'
  | 'text-secondary'
  | 'text-tertiary'
  | 'text-on-brand'
  | 'text-disabled'
  | 'text-link'
  | 'text-link-hover'
  | 'focus-ring'
  | 'focus-ring-error';

export type PrimitiveColor =
  | `green-${50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950}`
  | `mono-${0 | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 | 1000}`
  | `red-${500 | 600 | 700 | 900 | 950}`
  | `yellow-${500 | 600 | 900 | 950}`
  | `cyan-${500 | 600 | 900 | 950}`;

/* ========================================
   SPACING TOKENS
   ======================================== */

export type SpacingToken =
  | 'px'
  | '0'
  | '0-5'
  | '1'
  | '1-5'
  | '2'
  | '2-5'
  | '3'
  | '3-5'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | '11'
  | '12'
  | '14'
  | '16'
  | '20'
  | '24'
  | '28'
  | '32'
  | '36'
  | '40'
  | '44'
  | '48'
  | '52'
  | '56'
  | '60'
  | '64'
  | '72'
  | '80'
  | '96';

/* ========================================
   TYPOGRAPHY TOKENS
   ======================================== */

export type FontSizeToken =
  | 'xs'
  | 'sm'
  | 'base'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | '5xl'
  | '6xl'
  | '7xl'
  | '8xl'
  | '9xl';

export type FluidFontSize = `fluid-${FontSizeToken}`;

export type FontWeightToken = 'normal' | 'medium' | 'semibold' | 'bold';

export type LineHeightToken = 'tight' | 'normal' | 'relaxed';

export type LetterSpacingToken = 'tight' | 'normal' | 'wide';

export type FontFamilyToken = 'sans' | 'mono';

/* ========================================
   BORDER TOKENS
   ======================================== */

export type BorderRadiusToken =
  | 'none'
  | 'xs'
  | 'sm'
  | 'base'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | 'full';

export type BorderWidthToken = 'thin' | 'base' | 'thick';

/* ========================================
   SHADOW TOKENS
   ======================================== */

export type ShadowToken =
  | 'xs'
  | 'sm'
  | 'base'
  | 'md'
  | 'lg'
  | 'xl'
  | 'focus'
  | 'glow'
  | 'glow-strong';

/* ========================================
   ANIMATION TOKENS
   ======================================== */

export type DurationToken =
  | '0'
  | '75'
  | '100'
  | '150'
  | '200'
  | '250'
  | '300'
  | '350'
  | '400'
  | '500'
  | '700'
  | '1000';

export type EasingToken =
  | 'linear'
  | 'in'
  | 'out'
  | 'in-out'
  | 'bounce'
  | 'spring';

/* ========================================
   Z-INDEX TOKENS
   ======================================== */

export type ZIndexToken =
  | '0'
  | '10'
  | '20'
  | '30'
  | '40'
  | '50'
  | 'auto'
  | 'dropdown'
  | 'sticky'
  | 'fixed'
  | 'modal-backdrop'
  | 'modal'
  | 'popover'
  | 'tooltip'
  | 'toast'
  | 'max';

/* ========================================
   COMPONENT TOKENS
   ======================================== */

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type InputSize = 'sm' | 'md' | 'lg';
export type InputState = 'default' | 'hover' | 'focus' | 'error' | 'disabled';

export type CardSize = 'sm' | 'md' | 'lg';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

export type AlertVariant = 'success' | 'warning' | 'error' | 'info';

/* ========================================
   DESIGN TOKEN HELPERS
   ======================================== */

/**
 * Gets a design token value from CSS custom properties
 * @param token - The token name (without -- prefix)
 * @returns The CSS custom property value
 */
export function getToken(token: string): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--${token}`)
    .trim();
}

/**
 * Gets a color token value
 * @param color - The color token name
 * @returns The color value
 */
export function getColor(color: ColorToken): string {
  return getToken(`color-${color}`);
}

/**
 * Gets a primitive color value
 * @param color - The primitive color token name
 * @returns The color value
 */
export function getPrimitiveColor(color: PrimitiveColor): string {
  return getToken(`primitive-${color}`);
}

/**
 * Gets a spacing value
 * @param space - The spacing token name
 * @returns The spacing value
 */
export function getSpacing(space: SpacingToken): string {
  return getToken(`space-${space}`);
}

/**
 * Gets a primitive spacing value
 * @param space - The primitive spacing token name
 * @returns The spacing value
 */
export function getPrimitiveSpacing(space: SpacingToken): string {
  return getToken(`primitive-space-${space}`);
}

/**
 * Gets a font size value
 * @param size - The font size token name
 * @returns The font size value
 */
export function getFontSize(size: FontSizeToken | FluidFontSize): string {
  return getToken(`font-size-${size}`);
}

/**
 * Gets a shadow value
 * @param shadow - The shadow token name
 * @returns The shadow value
 */
export function getShadow(shadow: ShadowToken): string {
  return getToken(`shadow-${shadow}`);
}

/**
 * Gets a duration value
 * @param duration - The duration token name
 * @returns The duration value
 */
export function getDuration(duration: DurationToken): string {
  return getToken(`duration-${duration}`);
}

/**
 * Gets a border radius value
 * @param radius - The border radius token name
 * @returns The border radius value
 */
export function getRadius(radius: BorderRadiusToken): string {
  return getToken(`radius-${radius}`);
}

/**
 * Gets a font weight value
 * @param weight - The font weight token name
 * @returns The font weight value
 */
export function getFontWeight(weight: FontWeightToken): string {
  return getToken(`font-weight-${weight}`);
}

/**
 * Gets a line height value
 * @param lineHeight - The line height token name
 * @returns The line height value
 */
export function getLineHeight(lineHeight: LineHeightToken): string {
  return getToken(`line-height-${lineHeight}`);
}

/**
 * Gets a letter spacing value
 * @param letterSpacing - The letter spacing token name
 * @returns The letter spacing value
 */
export function getLetterSpacing(letterSpacing: LetterSpacingToken): string {
  return getToken(`letter-spacing-${letterSpacing}`);
}

/* ========================================
   DESIGN TOKEN CONSTANTS
   ======================================== */

/**
 * All available color tokens
 */
export const COLOR_TOKENS: readonly ColorToken[] = [
  'brand-primary',
  'brand-primary-hover',
  'brand-primary-active',
  'brand-primary-dim',
  'brand-secondary',
  'brand-secondary-hover',
  'brand-secondary-active',
  'neutral-0',
  'neutral-50',
  'neutral-100',
  'neutral-200',
  'neutral-300',
  'neutral-400',
  'neutral-500',
  'neutral-600',
  'neutral-700',
  'neutral-800',
  'neutral-900',
  'neutral-1000',
  'success',
  'success-bg',
  'success-border',
  'warning',
  'warning-bg',
  'warning-border',
  'error',
  'error-bg',
  'error-border',
  'info',
  'info-bg',
  'info-border',
  'background',
  'background-elevated',
  'background-overlay',
  'surface',
  'border',
  'border-strong',
  'text-primary',
  'text-secondary',
  'text-tertiary',
  'text-on-brand',
  'text-disabled',
  'text-link',
  'text-link-hover',
  'focus-ring',
  'focus-ring-error',
] as const;

/**
 * Matrix theme presets
 */
export const MATRIX_THEME = {
  primary: '#1aff1a',
  secondary: '#00ff00',
  background: '#000000',
  text: '#1aff1a',
  border: '#1aff1a',
} as const;

/**
 * Breakpoint values
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Container max widths
 */
export const CONTAINER_MAX_WIDTHS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

/* ========================================
   THEME TYPES
   ======================================== */

export type Theme = 'light' | 'dark';

export interface DesignTokens {
  colors: Record<ColorToken, string>;
  spacing: Record<SpacingToken, string>;
  typography: {
    fontSizes: Record<FontSizeToken, string>;
    fontWeights: Record<FontWeightToken, number>;
    lineHeights: Record<LineHeightToken, number>;
    letterSpacing: Record<LetterSpacingToken, string>;
    fontFamilies: Record<FontFamilyToken, string>;
  };
  borders: {
    radii: Record<BorderRadiusToken, string>;
    widths: Record<BorderWidthToken, string>;
  };
  shadows: Record<ShadowToken, string>;
  animation: {
    durations: Record<DurationToken, string>;
    easings: Record<EasingToken, string>;
  };
  zIndices: Record<ZIndexToken, number | string>;
}

/**
 * Type guard to check if a value is a valid color token
 */
export function isColorToken(value: string): value is ColorToken {
  return COLOR_TOKENS.includes(value as ColorToken);
}

/**
 * Validates a color value (hex, rgb, rgba, hsl, hsla)
 */
export function isValidColor(color: string): boolean {
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  const rgbRegex = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/;
  const rgbaRegex = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/;
  const hslRegex = /^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/;
  const hslaRegex = /^hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*[\d.]+\s*\)$/;

  return (
    hexRegex.test(color) ||
    rgbRegex.test(color) ||
    rgbaRegex.test(color) ||
    hslRegex.test(color) ||
    hslaRegex.test(color)
  );
}
