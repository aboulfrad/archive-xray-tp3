import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';
import hooks from 'eslint-plugin-react-hooks';

export default ts.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '.opencode/**',
      'preuves/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.worker } },
    plugins: { 'react-hooks': hooks },
    rules: {
      ...hooks.configs.recommended.rules,
      eqeqeq: 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
