export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Scope is a feature area (shell, hero, css, layout, resume, …) — open set, no enum restriction.
    'scope-enum': [0],
    'scope-empty': [2, 'never'],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
  },
};
