import nx from '@nx/eslint-plugin';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/.next',
      '**/node_modules',
      '**/.nx',
      '**/next-env.d.ts',
      '**/storybook-static/**',
      '**/.storybook/manager-head-snippet.js',
      '**/.storybook/preview-head-snippet.js',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:lib', 'type:util'],
            },
            {
              sourceTag: 'type:lib',
              onlyDependOnLibsWithTags: ['type:lib', 'type:util'],
            },
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // TypeScript Strict Rules - Enterprise Standard
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'error',

      // React Rules
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-no-target-blank': 'error',
      'react/jsx-key': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Code Quality
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],

      // Import Organization
      'sort-imports': ['error', { ignoreDeclarationSort: true }],
    },
  },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    // Ignore Storybook generated files (bundled/preview code)
    files: [
      '**/.storybook/manager-head-snippet.js',
      '**/.storybook/preview-head-snippet.js',
      '**/storybook-static/**/*',
      '**/.storybook/**/iframe.html',
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
