import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    "dist/**",
    "coverage/**",
    "preview/**",
    "qa/**",
    "University-Planner.html",
    "tests/ui-smoke.py",
  ]),
  {
    files: ["packages/planner-core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/database/**",
                "**/assistant/**",
                "**/integrations/**",
                "**/apps/**",
                "next",
                "next/**",
                "react",
                "react/**"
              ],
              message:
                "planner-core must remain deterministic and independent from database, network, UI, and AI layers."
            }
          ]
        }
      ]
    }
  }
]);
