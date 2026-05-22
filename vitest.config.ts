import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    exclude: ['**/node_modules/**', '**/tests/a11y/**', '**/tests/e2e/**', '**/.claude/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      // Enforce 60% lines coverage — exits with code 1 if not met.
      thresholds: {
        lines: 60,
      },
      include: ['lib/**', 'components/**', 'app/**'],
      exclude: ['**/node_modules/**', '**/__tests__/**', '**/tests/**', '**/content/**'],
      reportsDirectory: 'coverage',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // 'server-only' is a Next.js bundler signal — its package.json maps the
      // 'react-server' export condition to a throwing stub. Outside Next
      // (vitest's vite transformer), the resolver can't find a default entry
      // and import-analysis fails. Map it to an empty module so any
      // server-only-guarded library file (lib/ip-hash.ts, lib/ask/system-
      // prompt.ts, etc.) can be imported under test without per-test mocks.
      'server-only': path.resolve(__dirname, 'tests/mocks/server-only.ts'),
    },
  },
});
