import { format } from 'node:util';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

const ACT_WARNING_FRAGMENT = 'not wrapped in act';
const ACT_ENVIRONMENT_FLAG = 'IS_REACT_ACT_ENVIRONMENT';

Reflect.set(globalThis, ACT_ENVIRONMENT_FLAG, true);

const actWarnings: string[] = [];
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const first = args[0];
  if (typeof first === 'string' && first.includes(ACT_WARNING_FRAGMENT)) {
    actWarnings.push(format(...args));
    return;
  }
  originalConsoleError(...args);
};

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
  if (actWarnings.length === 0) return;
  const seen = actWarnings.splice(0).map((message) => message.split('\n')[0]);
  throw new Error(`React state updates ran outside act(): ${seen.join(' | ')}`);
});
