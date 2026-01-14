import baseConfig from '../../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {},
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {},
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    rules: {},
  },
  {
    // Ignore Storybook generated/bundled files
    files: [
      '.storybook/**/*.js',
      '.storybook/**/*.ts',
      'storybook-static/**/*',
    ],
    rules: {
      'no-var': 'off',
      'prefer-const': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off',
    },
  },
];
