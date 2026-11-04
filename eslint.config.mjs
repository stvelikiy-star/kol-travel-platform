import { defineConfig, globalIgnores } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const kolPlugin = {
  rules: {
    "no-img-element": {
      meta: {
        type: "suggestion",
        docs: { description: "Use optimized Next Image elements for app imagery" },
        schema: [],
        messages: { useImage: "Use next/image for application imagery." }
      },
      create(context) {
        return {
          JSXOpeningElement(node) {
            if (node.name.type === "JSXIdentifier" && node.name.name === "img") {
              context.report({ node, messageId: "useImage" });
            }
          }
        };
      }
    }
  }
};

export default defineConfig([
  tseslint.configs.base,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    ...react.configs.flat.recommended,
    settings: { react: { version: "detect" } },
    rules: {
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off"
    }
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    ...reactHooks.configs.flat.recommended
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    ...jsxA11y.flatConfigs.recommended
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    plugins: { kol: kolPlugin },
    rules: { "kol/no-img-element": "error" }
  },
  {
    files: ["src/app/presentation/page.tsx"],
    rules: {
      // This public presentation is a visual-QA route with approved remote media URLs.
      "kol/no-img-element": "off"
    }
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"])
]);
