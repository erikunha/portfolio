/**
 * Lint-Staged Configuration
 * Runs linters/formatters only on staged files
 * @see https://github.com/lint-staged/lint-staged
 */
export default {
  // TypeScript/JavaScript/TSX/JSX files
  '*.{js,jsx,ts,tsx}': [
    'eslint --fix', // Fix linting issues
    'prettier --write', // Format code
  ],

  // CSS/SCSS files
  '*.{css,scss}': [
    'prettier --write', // Format styles
  ],

  // JSON/YAML/Markdown files
  '*.{json,yaml,yml,md,mdx}': [
    'prettier --write', // Format documentation
  ],

  // Package files - check only, don't auto-fix
  'package.json': ['prettier --write'],
};
