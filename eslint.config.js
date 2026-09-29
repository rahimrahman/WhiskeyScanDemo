// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const { fixupPluginRules } = require('@eslint/compat');
const expoConfig = require('eslint-config-expo/flat');
const reactNative = require('eslint-plugin-react-native');
const unusedImports = require('eslint-plugin-unused-imports');

const portableUiImportPatterns = [
  {
    group: ['@/components/*', '@/components/**', '@/lib/*', '@/lib/**'],
    message:
      'ui-components stay generic: no feature components or lib. Compose them in src/components.',
  },
  {
    group: ['tailwind-merge', 'tailwind-merge/*', 'tailwind-merge/**'],
    message:
      'Use cn() from @/ui-components/cn instead of importing tailwind-merge directly.',
  },
];

/** Components that render RN Text (or wrap string labels safely). Keep this list tight. */
const rawTextAllowedHosts = ['Text', 'Button'];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'coverage/*'],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      'unused-imports': unusedImports,
      // Flat-config compat — plugin ships legacy format (eslint-plugin-react-native#333).
      'react-native': fixupPluginRules(reactNative),
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: true,
      },
    },
    rules: {
      'import/no-duplicates': 'error',
      'import/export': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'unused-imports/no-unused-imports': 'error',
      'react-native/no-raw-text': ['error', { skip: rawTextAllowedHosts }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'max-lines': [
        'error',
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/__tests__/**/*.ts',
      '**/__tests__/**/*.tsx',
    ],
    rules: {
      'max-lines': [
        'error',
        { max: 800, skipBlankLines: true, skipComments: true },
      ],
      // Jest hoists jest.mock; SUT imports often follow mocks. Mock factories use require().
      'import/first': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['src/ui-components/**/*.{ts,tsx}'],
    ignores: ['src/ui-components/cn.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: portableUiImportPatterns }],
    },
  },
  {
    files: ['src/ui-components/cn.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [portableUiImportPatterns[0]],
        },
      ],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: ['src/ui-components/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [portableUiImportPatterns[1]],
        },
      ],
    },
  },
]);
