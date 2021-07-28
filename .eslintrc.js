module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  extends: ['airbnb-base', 'prettier'],
  plugins: ['prettier'],
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    'prettier/prettier': [
      'error',
      {
        endOfLine: 'auto',
        singleQuote: true,
        printWidth: 200,
      },
    ],
    'no-inner-declarations': 'off',
    'no-prototype-builtins': 'off',
    'no-underscore-dangle': 'off',
    'no-await-in-loop': 'off',
    'no-param-reassign': 'off',
    'no-restricted-syntax': 'off',
    'no-plusplus': 'off',
  },
};
