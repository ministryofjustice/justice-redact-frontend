import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "node_modules/**",
    "next-env.d.ts",

    "public/assets/**",
    "public/moj/assets/**",
    "public/pdf.worker.min.mjs",
  ]),

  ...nextVitals,
  ...nextTs,
]);

export default eslintConfig;