import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist", "src/api/schema.d.ts", "e2e/report", "e2e/results"] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  // Plain JavaScript config files aren't part of the TypeScript project.
  { files: ["**/*.js"], extends: [tseslint.configs.disableTypeChecked] },
  // Nor are the Node scripts, which run on their own.
  {
    files: ["scripts/**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  // A component file stays small enough to read: split one past this (docs/STYLE_GUIDE.md).
  // Tests are left out, one file per feature.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/api/schema.d.ts"],
    rules: { "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }] },
  },
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite,
  prettier,
);
