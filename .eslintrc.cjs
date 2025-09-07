/* eslint-env node */
module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier', 'jest', 'simple-import-sort'],
  extends: [
    '@react-native/eslint-config',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:prettier/recommended',
  ],
  parserOptions: {
    ecmaFeatures: { jsx: true },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'prettier/prettier': 'warn',
    'simple-import-sort/imports': 'warn',
    'simple-import-sort/exports': 'warn',
    'import/order': 'off',
    'react/react-in-jsx-scope': 'off',
    'react-native/no-inline-styles': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'off',
  },
  overrides: [
    {
      files: ['*.config.js', 'babel.config.js', 'tailwind.config.js'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
  ],
};
