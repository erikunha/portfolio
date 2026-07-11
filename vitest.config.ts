import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
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
        lines: 80,
        branches: 70,
        functions: 80,
        statements: 80,
      },
      include: [
        'lib/**',
        'components/**',
        'app/**',
        'design-system/components/**',
        'design-system/lib/**',
      ],
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
