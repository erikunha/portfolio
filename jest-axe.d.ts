/**
 * Type declarations for jest-axe
 * Provides TypeScript support for accessibility testing matchers
 */

import type { AxeResults, RunOptions } from 'axe-core';

declare module 'jest-axe' {
  export function axe(
    html: Element | Document | string,
    options?: RunOptions,
  ): Promise<AxeResults>;

  export function toHaveNoViolations(): jest.CustomMatcher;
}

declare global {
  namespace jest {
    interface Matchers<R = void> {
      toHaveNoViolations(): R;
    }
  }
}

export {};
