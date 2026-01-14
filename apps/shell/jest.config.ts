import type { Config } from 'jest';

export default {
  displayName: 'shell',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        jsx: 'react-jsx',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/apps/shell',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/../../jest.setup.ts'],
  moduleNameMapper: {
    '^@erikunha-portifolio/ui$': '<rootDir>/../../libs/shared/ui/src/index.ts',
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
    '^.+\\.(css|sass|scss)$': '<rootDir>/__mocks__/styleMock.js',
    '^.+\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/__mocks__/fileMock.js',
  },
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    },
    './components/skip-links/skip-links.tsx': {
      statements: 95,
      branches: 95,
      functions: 95,
      lines: 95,
    },
  },
} satisfies Config;
