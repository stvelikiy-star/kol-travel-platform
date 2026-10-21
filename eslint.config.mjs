import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"], ...js.configs.recommended },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-has-content": "error",
      "no-restricted-syntax": ["warn", { selector: "JSXOpeningElement[name.name='img']", message: "Prefer next/image over raw img elements." }],
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  { files: ["src/app/presentation/page.tsx"], rules: { "no-restricted-syntax": "off" } },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"])
]);
