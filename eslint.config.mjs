// Lints the new TypeScript workspaces only. The legacy app (js/, data/, test/,
// build.js) keeps its own conventions until it is retired in phase 3.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: ['js/**', 'data/**', 'test/**', 'build.js', 'dist/**', 'vendor/**', 'assets/**', '**/node_modules/**', 'app/dist/**', 'app/public/**', 'server/dist/**', 'app/test-results/**', 'app/playwright-report/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['core/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    // core/src must stay free of DOM and Node APIs, so it runs in the browser
    // and on the server alike. Node-only helpers live in core/src/node.ts.
    files: ['core/src/**/*.ts'],
    ignores: ['core/src/node.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['node:*', 'fs', 'path', 'url'], message: 'core/src must not use Node APIs (only core/src/node.ts may).' }] }],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'navigator', 'fetch', 'process'],
      'no-restricted-properties': ['error',
        { object: 'Math', property: 'random', message: 'Pass randomness in; core must be deterministic.' },
        { object: 'Date', property: 'now', message: 'Pass the clock in; core must be deterministic.' }],
    },
  },
  {
    files: ['core/test/**/*.ts', 'core/test/**/*.mjs', 'core/scripts/**/*.ts', 'core/src/node.ts', 'core/vitest.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // the app: React with the compiler's rules, never raw HTML
    files: ['app/src/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat['recommended-latest'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.flat['recommended-latest'].rules,
      '@typescript-eslint/consistent-type-imports': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-restricted-syntax': ['error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'No raw HTML in the app (CLAUDE.md).' },
        { selector: "MemberExpression[property.name='innerHTML']", message: 'No raw HTML in the app (CLAUDE.md).' }],
    },
  },
  {
    files: ['app/*.ts', 'app/e2e/**/*.ts', 'app/scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // the server: Node, same strictness as core
    files: ['server/**/*.{ts,mjs}'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    // the static mockups: a plain script loaded by the pages, no modules
    files: ['docs/mockups/**/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser } },
  },
);
