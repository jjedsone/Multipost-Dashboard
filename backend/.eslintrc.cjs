module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  extends: ['eslint:recommended', 'plugin:node/recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script',
  },
  rules: {
    'node/no-unsupported-features/es-builtins': 'off',
    'node/no-unsupported-features/node-builtins': 'off',
    'node/no-unsupported-features/es-syntax': 'off',
  },
};

