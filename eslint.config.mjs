import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    files: ["src/app/presentation/page.tsx"],
    rules: {
      // Presentation intentionally exercises verified direct remote media URLs in Visual QA.
      // Keep the browser path direct here instead of routing these assets through Next image optimization.
      "@next/next/no-img-element": "off"
    }
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"])
]);
