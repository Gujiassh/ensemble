import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const functionSizeRule = (max) => [
  "error",
  { max, skipBlankLines: true, skipComments: true },
];

export default tseslint.config(
  { ignores: ["dist", "coverage"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      complexity: ["error", 30],
      "max-depth": ["error", 4],
      "max-lines-per-function": functionSizeRule(220),
      "max-params": ["error", 4],
      "no-param-reassign": ["error", { props: false }],
      "react-refresh/only-export-components": [
        "error",
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ["src/**/*.{jsx,tsx}"],
    rules: {
      "max-lines-per-function": functionSizeRule(400),
    },
  },
  {
    files: [
      "src/test-support/**/*.{js,jsx,ts,tsx}",
      "src/**/*.{test,spec}.{js,jsx,ts,tsx}",
    ],
    rules: {
      "max-lines-per-function": functionSizeRule(500),
    },
  },
);
