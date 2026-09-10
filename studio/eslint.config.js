// Flat config. ESLint 9 dropped automatic .eslintrc support, so this replaces
// the previous .eslintrc.cjs. Rule selection is carried over unchanged; only
// the config format and the plugin/parser versions differ.
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Replaces the old `ignorePatterns`. Flat config ignores nothing except
    // node_modules by default, so build output must be listed explicitly.
    ignores: [
      "dist/**",
      "dist-electron/**",
      "electron/**",
      "coverage/**",
      "tauri/**",
      "**/*.config.*",
      "eslint.config.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Standalone Node CommonJS helper scripts (e.g. the favicon generator).
    // They need node globals and CJS module semantics, which the TS/TSX block
    // below does not provide.
    files: ["**/*.{js,cjs}"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node, ...globals.es2023 },
      parserOptions: {
        // Equivalent of the old `project: [./tsconfig.json, ./tsconfig.node.json]`.
        // projectService is the maintained replacement and picks up both.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      // Deliberately NOT spreading react-hooks' `recommended`. This package was
      // on eslint-plugin-react-hooks v4, whose recommended set is exactly the
      // two rules below. v7 adds ~15 React Compiler rules (immutability,
      // purity, set-state-in-effect, ...); adopting those is a separate call
      // with its own baseline, not something to smuggle into a config
      // migration. See the follow-up issue.
      "react-hooks/rules-of-hooks": "error",
      "max-lines": "off",
      complexity: "off",
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "no-restricted-imports": "off",
      "react-hooks/exhaustive-deps": "error",
      // New core rule in ESLint 10. It wants `new Error(msg, { cause })` when
      // rethrowing, but tsconfig targets ES2020 and `Error.cause` is ES2022,
      // so the fix it asks for does not typecheck. Revisit if the target moves.
      "preserve-caught-error": "off",
    },
  },
  {
    // Test files only. Every one of the 74 baseline `no-explicit-any` hits was
    // a vi.fn mock signature (`vi.fn<(...args: any[]) => any>`), which is the
    // normal way to type a mock. Production code under src/ has zero, and
    // keeps the rule as an error.
    files: ["**/__tests__/**/*.{ts,tsx}", "**/*.{test,spec}.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
