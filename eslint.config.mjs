//@ts-check
import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import { defineConfig } from 'eslint/config';

const browserGlobals = {
  browser: 'readonly',
  btoa: 'readonly',
  chrome: 'readonly',
  console: 'readonly',
  CustomEvent: 'readonly',
  Document: 'readonly',
  document: 'readonly',
  Element: 'readonly',
  Event: 'readonly',
  fetch: 'readonly',
  globalThis: 'readonly',
  location: 'readonly',
  navigator: 'readonly',
  Option: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  TextEncoder: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  window: 'readonly',
};

const nodeGlobals = {
  Buffer: 'readonly',
  console: 'readonly',
  process: 'readonly',
};

export default defineConfig(
  eslint.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['options/**/*.js', 'src/**/*.js'],
    languageOptions: {
      globals: browserGlobals,
    },
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.js'],
    languageOptions: {
      globals: {
        ...browserGlobals,
        ...nodeGlobals,
        Event: 'readonly',
        EventTarget: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
      },
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },
);
