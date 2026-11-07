import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

function noMatchMediaQueryList(query: string): MediaQueryList {
  return {
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  };
}

beforeEach(() => {
  if (typeof window === 'undefined') return;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: noMatchMediaQueryList,
  });
});

afterEach(() => {
  cleanup();
});
