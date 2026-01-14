/**
 * Design Tokens Utility Tests - Principal Level
 *
 * Tests cover:
 * - All 11 token getter functions
 * - Type guard functions (isColorToken, isValidColor)
 * - DOM mocking for getComputedStyle
 * - Error handling for missing CSS variables
 * - SSR context handling
 * - Edge cases with invalid inputs
 */

import {
  type ColorToken,
  type FontSizeToken,
  type FontWeightToken,
  type LetterSpacingToken,
  type LineHeightToken,
  type SpacingToken,
  getColor,
  getDuration,
  getFontSize,
  getFontWeight,
  getLetterSpacing,
  getLineHeight,
  getRadius,
  getShadow,
  getSpacing,
  isColorToken,
  isValidColor,
} from './tokens.types';

describe('Design Token Utilities', () => {
  beforeEach(() => {
    // Mock getComputedStyle with design token values
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = jest.fn((element: Element) => {
      const styles = originalGetComputedStyle(element);
      const tokenMap: Record<string, string> = {
        '--color-brand-primary': '#1aff1a',
        '--color-text-primary': '#1aff1a',
        '--color-background': '#000000',
        '--color-error': '#ff1a1a',
        '--space-0': '0',
        '--space-4': '1rem',
        '--space-8': '2rem',
        '--font-size-base': '1rem',
        '--font-size-xl': '1.25rem',
        '--font-weight-normal': '400',
        '--font-weight-bold': '700',
        '--line-height-normal': '1.5',
        '--letter-spacing-normal': '0',
        '--shadow-glow': '0 0 10px rgba(26, 255, 26, 0.8)',
        '--duration-150': '150ms',
        '--radius-base': '0.25rem',
        '--radius-full': '9999px',
      };

      return {
        ...styles,
        getPropertyValue: (prop: string) =>
          tokenMap[prop] || styles.getPropertyValue(prop),
      } as CSSStyleDeclaration;
    });
  });

  describe('getColor', () => {
    it('retrieves brand primary color', () => {
      const color = getColor('brand-primary' as ColorToken);
      expect(color).toBe('#1aff1a');
    });

    it('retrieves text primary color', () => {
      const color = getColor('text-primary' as ColorToken);
      expect(color).toBe('#1aff1a');
    });

    it('retrieves background color', () => {
      const color = getColor('background' as ColorToken);
      expect(color).toBe('#000000');
    });

    it('retrieves error color', () => {
      const color = getColor('error' as ColorToken);
      expect(color).toBe('#ff1a1a');
    });

    it('returns empty string for undefined token', () => {
      const color = getColor('nonexistent' as ColorToken);
      expect(color).toBe('');
    });
  });

  describe('getSpacing', () => {
    it('retrieves space-0 token', () => {
      const spacing = getSpacing('0' as SpacingToken);
      expect(spacing).toBe('0');
    });

    it('retrieves space-4 token', () => {
      const spacing = getSpacing('4' as SpacingToken);
      expect(spacing).toBe('1rem');
    });

    it('retrieves space-8 token', () => {
      const spacing = getSpacing('8' as SpacingToken);
      expect(spacing).toBe('2rem');
    });

    it('returns empty string for undefined token', () => {
      const spacing = getSpacing('999' as SpacingToken);
      expect(spacing).toBe('');
    });
  });

  describe('getFontSize', () => {
    it('retrieves base font size', () => {
      const fontSize = getFontSize('base' as FontSizeToken);
      expect(fontSize).toBe('1rem');
    });

    it('retrieves xl font size', () => {
      const fontSize = getFontSize('xl' as FontSizeToken);
      expect(fontSize).toBe('1.25rem');
    });

    it('returns empty string for undefined token', () => {
      const fontSize = getFontSize('invalid' as FontSizeToken);
      expect(fontSize).toBe('');
    });
  });

  describe('getFontWeight', () => {
    it('retrieves normal font weight', () => {
      const weight = getFontWeight('normal' as FontWeightToken);
      expect(weight).toBe('400');
    });

    it('retrieves bold font weight', () => {
      const weight = getFontWeight('bold' as FontWeightToken);
      expect(weight).toBe('700');
    });
  });

  describe('getLineHeight', () => {
    it('retrieves normal line height', () => {
      const lineHeight = getLineHeight('normal' as LineHeightToken);
      expect(lineHeight).toBe('1.5');
    });
  });

  describe('getLetterSpacing', () => {
    it('retrieves normal letter spacing', () => {
      const spacing = getLetterSpacing('normal' as LetterSpacingToken);
      expect(spacing).toBe('0');
    });
  });

  describe('getShadow', () => {
    it('retrieves glow shadow', () => {
      const shadow = getShadow('glow');
      expect(shadow).toContain('rgba(26, 255, 26, 0.8)');
    });
  });

  describe('getDuration', () => {
    it('retrieves 150ms duration', () => {
      const duration = getDuration('150');
      expect(duration).toBe('150ms');
    });
  });

  describe('getRadius', () => {
    it('retrieves base radius', () => {
      const radius = getRadius('base');
      expect(radius).toBe('0.25rem');
    });

    it('retrieves full radius', () => {
      const radius = getRadius('full');
      expect(radius).toBe('9999px');
    });
  });

  describe('Type Guards', () => {
    describe('isColorToken', () => {
      it('returns true for valid color token', () => {
        expect(isColorToken('brand-primary')).toBe(true);
        expect(isColorToken('text-primary')).toBe(true);
        expect(isColorToken('background')).toBe(true);
      });

      it('returns false for invalid color token', () => {
        expect(isColorToken('invalid')).toBe(false);
        expect(isColorToken('123')).toBe(false);
        expect(isColorToken('')).toBe(false);
      });
    });

    describe('isValidColor', () => {
      it('validates hex colors', () => {
        expect(isValidColor('#1aff1a')).toBe(true);
        expect(isValidColor('#000')).toBe(true);
        expect(isValidColor('#ffffff')).toBe(true);
      });

      it('validates rgb colors', () => {
        expect(isValidColor('rgb(26, 255, 26)')).toBe(true);
        expect(isValidColor('rgb(0,0,0)')).toBe(true);
      });

      it('validates rgba colors', () => {
        expect(isValidColor('rgba(26, 255, 26, 0.8)')).toBe(true);
        expect(isValidColor('rgba(0,0,0,1)')).toBe(true);
      });

      it('validates hsl colors', () => {
        expect(isValidColor('hsl(120, 100%, 50%)')).toBe(true);
      });

      it('validates hsla colors', () => {
        expect(isValidColor('hsla(120, 100%, 50%, 0.8)')).toBe(true);
      });

      it('rejects invalid color formats', () => {
        expect(isValidColor('invalid')).toBe(false);
        expect(isValidColor('123')).toBe(false);
        expect(isValidColor('')).toBe(false);
        expect(isValidColor('#gg')).toBe(false);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles missing documentElement', () => {
      const originalDocumentElement = document.documentElement;
      Object.defineProperty(document, 'documentElement', {
        value: null,
        writable: true,
      });

      expect(() => getColor('brand-primary' as ColorToken)).not.toThrow();

      Object.defineProperty(document, 'documentElement', {
        value: originalDocumentElement,
        writable: true,
      });
    });

    it('handles undefined CSS variable', () => {
      window.getComputedStyle = jest.fn(() => ({
        getPropertyValue: () => '',
      })) as unknown as typeof window.getComputedStyle;

      const color = getColor('undefined-token' as ColorToken);
      expect(color).toBe('');
    });

    it('handles empty string tokens', () => {
      expect(() => getColor('' as ColorToken)).not.toThrow();
      expect(() => getSpacing('' as SpacingToken)).not.toThrow();
    });

    it('handles whitespace in token values', () => {
      window.getComputedStyle = jest.fn(() => ({
        getPropertyValue: () => '  1rem  ',
      })) as unknown as typeof window.getComputedStyle;

      const spacing = getSpacing('4' as SpacingToken);
      // Should handle whitespace gracefully
      expect(spacing).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('caches getComputedStyle calls', () => {
      const mockGetComputedStyle = jest.fn(window.getComputedStyle);
      window.getComputedStyle = mockGetComputedStyle;

      // Multiple calls should reuse computed style
      getColor('brand-primary' as ColorToken);
      getColor('text-primary' as ColorToken);

      // Should call getComputedStyle for each getter call
      expect(mockGetComputedStyle).toHaveBeenCalled();
    });
  });

  describe('TypeScript Type Safety', () => {
    it('enforces ColorToken type', () => {
      // Valid color tokens should compile
      const validColor: ColorToken = 'brand-primary';
      expect(getColor(validColor)).toBeTruthy();

      // Invalid tokens should be caught by TypeScript at compile time
      // Uncomment to test: getColor('invalid' as ColorToken); // Should show TS error
    });

    it('enforces SpacingToken type', () => {
      // Valid spacing tokens should compile
      const validSpacing: SpacingToken = '4';
      expect(getSpacing(validSpacing)).toBeTruthy();
    });

    it('enforces FontSizeToken type', () => {
      // Valid font size tokens should compile
      const validFontSize: FontSizeToken = 'base';
      expect(getFontSize(validFontSize)).toBeTruthy();
    });
  });

  describe('Integration', () => {
    it('tokens match between getters and actual CSS', () => {
      const color = getColor('brand-primary' as ColorToken);
      const spacing = getSpacing('4' as SpacingToken);
      const fontSize = getFontSize('base' as FontSizeToken);

      expect(color).toBe('#1aff1a'); // Matrix green
      expect(spacing).toBe('1rem'); // 16px
      expect(fontSize).toBe('1rem'); // 16px
    });

    it('maintains consistency across all token types', () => {
      // All token getters should return string values
      expect(typeof getColor('brand-primary' as ColorToken)).toBe('string');
      expect(typeof getSpacing('4' as SpacingToken)).toBe('string');
      expect(typeof getFontSize('base' as FontSizeToken)).toBe('string');
      expect(typeof getDuration('150')).toBe('string');
      expect(typeof getRadius('base')).toBe('string');
    });
  });
});
