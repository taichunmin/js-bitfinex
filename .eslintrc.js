module.exports = {
  env: {
    es2022: true,
    jest: true,
  },
  plugins: ['eslint-plugin-tsdoc'],
  extends: ['love'],
  rules: {
    '@typescript-eslint/consistent-indexed-object-style': 'off',
    '@typescript-eslint/consistent-type-definitions': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/non-nullable-type-assertion-style': 'off',
    '@typescript-eslint/return-await': 'off',
    '@typescript-eslint/strict-boolean-expressions': 'off',
    '@typescript-eslint/unbound-method': 'off',
    'multiline-ternary': 'off',
    'no-ex-assign': 'off',
    'no-return-await': 'off',
    'tsdoc/syntax': 'warn',
    'comma-dangle': ['error', {
      arrays: 'always-multiline',
      objects: 'always-multiline',
      imports: 'always-multiline',
      exports: 'always-multiline',
      functions: 'only-multiline',
    }],
    '@typescript-eslint/comma-dangle': ['error', {
      arrays: 'always-multiline',
      enums: 'always-multiline',
      exports: 'always-multiline',
      generics: 'always-multiline',
      imports: 'always-multiline',
      objects: 'always-multiline',
      tuples: 'always-multiline',
      functions: 'only-multiline',
    }],
  },
}