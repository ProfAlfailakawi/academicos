// ESLint flat config focused on accessibility (jsx-a11y) and hook safety.
// Run with `npm run lint:eslint`. Every rule reports as a warning so the large
// pre-existing codebase can be improved incrementally without failing CI;
// `npm run lint` (tsc) remains the blocking check.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

const asWarnings = (rules) =>
  Object.fromEntries(
    Object.entries(rules || {}).map(([name, value]) => {
      if (value === "off" || value === 0) return [name, value];
      if (Array.isArray(value)) return [name, ["warn", ...value.slice(1)]];
      return [name, "warn"];
    }),
  );

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "public/**", "coverage/**", "**/*.cjs", "scripts/**"],
  },
  {
    files: ["src/**/*.{ts,tsx}", "server.ts", "tests/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "jsx-a11y": jsxA11y,
      "react-hooks": reactHooks,
    },
    rules: {
      ...asWarnings(js.configs.recommended.rules),
      // TypeScript already checks undefined names and redeclarations.
      "no-undef": "off",
      "no-redeclare": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      ...asWarnings(jsxA11y.flatConfigs.recommended.rules),
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
);
