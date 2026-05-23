// Auto-cleanup @testing-library/react after each test.
// Required because vitest globals are disabled (globals: false), so the
// automatic afterEach hook injected by @testing-library/react doesn't fire.
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
