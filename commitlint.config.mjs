/**
 * Commitlint Configuration
 * Enforces Conventional Commits specification
 * Required for automated versioning and changelog generation
 */

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation only
        'style', // Code style (formatting, missing semi-colons, etc)
        'refactor', // Code refactoring
        'perf', // Performance improvement
        'test', // Adding tests
        'build', // Build system or dependencies
        'ci', // CI configuration
        'chore', // Other changes that don't modify src or test
        'revert', // Revert a previous commit
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'never', ['upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 100],
  },
};
