import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const firebaseImportPatterns = ["firebase", "firebase/*", "firebase-admin", "firebase-admin/*"];

const eslintConfig = tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      ".specify/**",
      ".claude/**",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // Solo la capa de servicios y los scripts pueden usar los SDK de Firebase (constitución I).
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: firebaseImportPatterns,
              message: "Importa Firebase solo desde src/services/** o scripts/** (constitución I).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/services/**", "scripts/**"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
);

export default eslintConfig;
