import type { Config } from 'jest';

export default {
  displayName: 'shared-ui',
  preset: '../../../jest.preset.js',
  testEnvironment: 'jsdom',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/../../../jest.setup.ts'],

  // Transform files with ts-jest and SWC
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },

  // Module name mapper for CSS modules and assets
  moduleNameMapper: {
    // CSS Modules
    '\\.module\\.(css|scss|sass)$': 'identity-obj-proxy',
    // Regular CSS imports (mock as empty object)
    '\\.(css|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
    // Images and other assets
    '\\.(jpg|jpeg|png|gif|svg|webp)$': '<rootDir>/__mocks__/fileMock.js',
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],

  // Coverage configuration - Principal Level Standards
  coverageDirectory: '../../../coverage/libs/shared/ui',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/index.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    },
    './src/lib/button/button.tsx': {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95,
    },
  },

  // Test match patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.[jt]s?(x)',
    '<rootDir>/src/**/*(*.)@(spec|test).[jt]s?(x)',
  ],

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.nx/'],

  // Globals for TypeScript
  globals: {},
} satisfies Config;
