// Flat config. ESLint 9 dropped automatic .eslintrc support, so this replaces
// the previous .eslintrc.cjs. Kept deliberately in step with studio's config -
// the two packages drifted onto incompatible eslint majors once already (#119).
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Replaces the old `ignorePatterns`. Flat config ignores nothing except
    // node_modules by default, so build output must be listed explicitly.
    ignores: ["dist/**", "coverage/**", "**/*.config.*", "eslint.config.js"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node, ...globals.es2023 },
      parserOptions: {
        // Equivalent of the old `project: [./tsconfig.json, ./tsconfig.node.json]`.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      // Only the two rules the previous config's react-hooks preset carried.
      // v7 adds ~15 React Compiler rules; adopting those is a separate call.
      "react-hooks/rules-of-hooks": "error",
      "max-lines": "off",
      complexity: "off",
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "no-restricted-imports": "off",
      // Carried over from .eslintrc.cjs, where this was "off" while studio had
      // it at "error". Left as-is rather than silently changing enforcement in
      // a config migration; the divergence is worth resolving separately.
      "react-hooks/exhaustive-deps": "off",
      // See studio's config: ES2020 target predates Error.cause (ES2022).
      "preserve-caught-error": "off",
    },
  },
  {
    files: ["**/__tests__/**/*.{ts,tsx}", "**/*.{test,spec}.{ts,tsx}"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
);
