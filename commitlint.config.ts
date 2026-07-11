export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [0],
    'scope-empty': [2, 'never'],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
  },
};
