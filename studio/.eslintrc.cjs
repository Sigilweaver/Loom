/* Phase 0 ESLint baseline tightening */
module.exports = {
  root: true,
  env: { browser: true, es2023: true, node: true },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: ["./tsconfig.json", "./tsconfig.node.json"],
    tsconfigRootDir: __dirname,
  },
  plugins: ["@typescript-eslint", "react-refresh", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  rules: {
    "max-lines": "off",
    complexity: "off",
    "@typescript-eslint/consistent-type-imports": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-restricted-imports": "off",
    "react-hooks/exhaustive-deps": "off",
  },
  ignorePatterns: [
    "dist",
    "dist-electron",
    "electron",
    "**/*.config.*",
    "vite.config.ts",
    ".eslintrc.cjs",
  ],
};
