/**
 * Type declarations for jest-axe
 * Provides TypeScript support for accessibility testing matchers
 */

import type { AxeResults } from 'axe-core';

declare module 'jest-axe' {
  export function axe(
    html: Element | Document | string,
    options?: any,
  ): Promise<AxeResults>;

  export function toHaveNoViolations(): any;
}

declare global {
  namespace jest {
    interface Matchers<R = void> {
      toHaveNoViolations(): R;
    }
  }
}

export {};
