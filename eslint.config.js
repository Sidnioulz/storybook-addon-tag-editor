import storybook from 'eslint-plugin-storybook';
import js from '@eslint/js';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import reactPlugin from 'eslint-plugin-react';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '.github/dependabot.yml',
      '!.*',
      '*.tgz',
      'dist/',
      'scripts/',
      'coverage/',
      'node_modules/',
      'storybook-static/',
      'build-storybook.log',
      '.DS_Store',
      '.env',
      '.idea',
      '.vscode',
    ],
  },
  js.configs.recommended,
  reactPlugin.configs.flat.recommended,
  {
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  ...tseslint.configs.recommended,
  ...storybook.configs['flat/recommended'],
  {
    // Test doubles stand in for Storybook's own loosely typed APIs.
    files: ['src/__tests__/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  prettierRecommended,
];
