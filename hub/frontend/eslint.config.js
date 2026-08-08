import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default [
    {
        ignores: ["dist", "**/*.config.*", "eslint.config.js"],
    },
    js.configs.recommended,
    ...tsPlugin.configs["flat/recommended"],
    reactHooks.configs.flat["recommended-latest"],
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2023,
            },
            parser: tsParser,
            parserOptions: {
                project: ["./tsconfig.json", "./tsconfig.node.json"],
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            "react-refresh": reactRefresh,
        },
        rules: {
            "max-lines": "off",
            complexity: "off",
            "@typescript-eslint/consistent-type-imports": "off",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
            ],
            "no-restricted-imports": "off",
            "react-hooks/exhaustive-deps": "off",
        },
    },
];
