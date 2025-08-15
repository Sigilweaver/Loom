/* Phase 0 ESLint baseline tightening */
module.exports = {
  root: true,
  env: { browser: true, es2023: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', project: ['./tsconfig.json'] },
  plugins: ['@typescript-eslint','react-refresh','react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended'
  ],
  rules: {
    'max-lines': ['warn', { max: 350, skipBlankLines: true, skipComments: true }],
    'complexity': ['warn', 12],
    '@typescript-eslint/consistent-type-imports': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-restricted-imports': [
      'warn',
      {
        patterns: [
          {
            group: ['../*'],
            message: 'Prefer absolute layer aliases (@domain, @state, @utils, @components, etc.) to enforce layering.'
          }
        ]
      }
    ]
  },
  ignorePatterns: ['dist','dist-electron','electron','**/*.config.*','vite.config.ts']
};
