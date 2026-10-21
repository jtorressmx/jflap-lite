import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
   globalIgnores(['node_modules/**', 'dist/**', 'release/**']),
   {
      files: [
         'src/**/*.{ts,tsx}',
         'vite.config.ts',
         'electron/**/*.cjs',
         'scripts/**/*.mjs',
         'eslint.config.mjs',
      ],
      extends: [js.configs.recommended],
      rules: {
         'no-console': 'error',
         'no-debugger': 'error',
         'no-empty': ['error', { allowEmptyCatch: false }],
      },
   },
   {
      files: ['src/**/*.{ts,tsx}', 'vite.config.ts'],
      extends: [tseslint.configs.recommended],
   },
   {
      files: ['src/**/*.{ts,tsx}'],
      languageOptions: { globals: globals.browser },
      plugins: { 'react-hooks': reactHooks },
      rules: {
         'react-hooks/rules-of-hooks': 'error',
         'react-hooks/exhaustive-deps': 'error',
      },
   },
   {
      files: ['vite.config.ts', 'electron/**/*.cjs', 'scripts/**/*.mjs', 'eslint.config.mjs'],
      languageOptions: { globals: globals.node },
   },
]);
