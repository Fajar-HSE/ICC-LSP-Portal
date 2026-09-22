import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'node_modules/',
      'supabase/.temp/',
      '*.json',
      'check_status.js',
      'index.legacy.html',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            '*.js',
            '*.cjs',
            '*.mjs',
            'eslint.config.js',
            'vite.config.ts',
            'vitest.config.ts',
            'playwright.config.ts',
            'e2e/*.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-meaningless-void-operator': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      '@typescript-eslint/dot-notation': 'off',
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      '@typescript-eslint/no-unnecessary-type-conversion': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/prefer-regexp-exec': 'off',
    },
  },
);
