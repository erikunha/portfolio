/**
 * Global Jest Setup
 * Principal-Level Testing Configuration
 *
 * This file runs once before all tests to configure the testing environment
 * with custom matchers, accessibility testing, and global mocks.
 */

/// <reference types="jest" />

import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';
import { afterEach } from 'node:test';

// Extend Jest matchers with jest-axe for accessibility testing
expect.extend(toHaveNoViolations);

// Mock Next.js router for all tests
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  })),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  useParams: jest.fn(() => ({})),
}));

// Mock window.matchMedia for media query tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock IntersectionObserver for components using lazy loading
global.IntersectionObserver = class IntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '0px';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor() {}
  disconnect(): void {}
  observe(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve(): void {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver implements ResizeObserver {
  constructor() {}
  disconnect(): void {}
  observe(): void {}
  unobserve(): void {}
};

// Mock scrollIntoView for skip links tests
Element.prototype.scrollIntoView = jest.fn();

// Mock getComputedStyle for design token tests
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = jest.fn((element: Element) => {
  // Handle null/undefined element gracefully
  if (!element) {
    return {
      getPropertyValue: () => '',
    } as unknown as CSSStyleDeclaration;
  }

  const styles = originalGetComputedStyle(element);
  // Add custom CSS variable support for tests
  return {
    ...styles,
    getPropertyValue: (prop: string) => {
      // Mock common design tokens
      const tokenMap: Record<string, string> = {
        '--color-brand-primary': '#1aff1a',
        '--space-4': '1rem',
        '--font-size-base': '1rem',
        '--duration-fast': '150ms',
        '--radius-base': '0.25rem',
      };
      return tokenMap[prop] || styles.getPropertyValue(prop);
    },
  } as CSSStyleDeclaration;
});

// Suppress console errors in tests (optional, comment out for debugging)
// global.console.error = jest.fn();
// global.console.warn = jest.fn();

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
});
