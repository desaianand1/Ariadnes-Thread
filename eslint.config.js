import globals from 'globals'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintPluginSvelte from 'eslint-plugin-svelte'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  {
    // Global configuration
    files: ['**/*.{js,ts,svelte}'],
    ignores: ['node_modules/**', 'dist/**'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      svelte: eslintPluginSvelte
    },
    // Base configuration for all files
    rules: {
      ...js.configs.recommended.rules,
      ...prettierConfig.rules
    }
  },
  // TypeScript files configuration
  {
    files: ['**/*.ts'],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.strictTypeChecked
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json'
      }
    }
  },
  // Svelte files configuration
  {
    files: ['**/*.svelte'],
    extends: [eslintPluginSvelte.configs.recommended],
    languageOptions: {
      parser: eslintPluginSvelte.parser
    },
    rules: {
      'svelte/valid-compile': 'error',
      'svelte/no-implicit-any': 'error'
    }
  }
)