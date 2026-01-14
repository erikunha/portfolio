import type { Config } from 'jest';

export default {
  displayName: 'styles',
  preset: '../../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js'],
  coverageDirectory: '../../../coverage/libs/shared/styles',
  setupFilesAfterEnv: ['<rootDir>/../../../jest.setup.ts'],
} satisfies Config;
