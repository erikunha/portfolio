import path from 'node:path';
import { defineConfig } from 'vitest/config';

const ISO_DATE_LENGTH = 10;

// The thresholds the README states, exported so the documentation and the gate
// cannot drift apart: a threshold lowered here has to be restated there.
export const COVERAGE_THRESHOLDS = {
  lines: 80,
  branches: 70,
  functions: 80,
  statements: 80,
} as const;

export default defineConfig({
  test: {
    env: { BUILD_DATE: new Date().toISOString().slice(0, ISO_DATE_LENGTH) },
    reporters: process.env.GITHUB_ACTIONS ? ['github-actions', 'verbose'] : ['verbose'],
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/mocks/rtl-setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/tests/a11y/**',
      '**/tests/e2e/**',
      '**/tests/visual/**',
      '**/.claude/**',
      '**/.worktrees/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        ...COVERAGE_THRESHOLDS,
      },
      include: ['lib/**', 'components/**', 'app/**', 'design-system/components/**'],
      exclude: [
        '**/node_modules/**',
        '**/__tests__/**',
        '**/tests/**',
        '**/content/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/index.ts',
        '**/*.e2e.ts',
        '**/*.module.css',
        '**/*.mjs',
      ],
      reportsDirectory: 'coverage',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'server-only': path.resolve(__dirname, 'tests/mocks/server-only.ts'),
    },
  },
});
