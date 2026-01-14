/**
 * Matrix Design System - TypeScript API
 *
 * Type-safe access to all design tokens and utilities
 * Comprehensive design system for production applications
 *
 * @packageDocumentation
 * @module @erikunha/shared/styles
 */

// Export all token types
export * from './tokens.types';

// Export type-safe token getters
export {
  getColor,
  getDuration,
  getFontSize,
  getPrimitiveColor,
  getPrimitiveSpacing,
  getRadius,
  getShadow,
  getSpacing,
  getToken,
  isColorToken,
  isValidColor,
} from './tokens.types';

// Export constants
export {
  BREAKPOINTS,
  COLOR_TOKENS,
  CONTAINER_MAX_WIDTHS,
  MATRIX_THEME,
} from './tokens.types';

// Legacy paths for compatibility
export const DESIGN_TOKENS_PATH = './index.css';
export const TOKENS_PATH = './tokens.css';
export const GLOBAL_STYLES_PATH = './global.css';
export const PRIMITIVES_PATH = './primitives.css';
export const COMPONENT_TOKENS_PATH = './component-tokens.css';
export const TYPOGRAPHY_PATH = './typography.css';
export const ANIMATIONS_PATH = './animations.css';
export const ACCESSIBILITY_PATH = './accessibility.css';

// Re-export types for convenience
export type {
  AlertVariant,
  BorderRadiusToken,
  BorderWidthToken,
  Breakpoint,
  ButtonSize,
  ButtonVariant,
  CardSize,
  ColorToken,
  DesignTokens,
  DurationToken,
  EasingToken,
  FluidFontSize,
  FontFamilyToken,
  FontWeightToken,
  InputSize,
  InputState,
  LetterSpacingToken,
  LineHeightToken,
  ModalSize,
  PrimitiveColor,
  ShadowToken,
  SpinnerSize,
  Theme,
  ZIndexToken,
} from './tokens.types';

/**
 * Helper to get CSS variable reference
 * Usage: getCSSVar('color', 'brand-primary') => 'var(--color-brand-primary)'
 */
export function getCSSVar(category: string, token: string): string {
  return `var(--${category}-${token})`;
}
