import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // site/dist and site/.astro are the Astro site's build output. They are
    // gitignored and CI never builds the site, so linting them only ever
    // happens on a developer's machine — 93 errors in generated files nobody
    // may edit, invisible to CI and impossible to act on.
    ignores: [
      ".next/**",
      ".next-e2e/**",
      "out/**",
      "build/**",
      "site/dist/**",
      "site/.astro/**",
      "next-env.d.ts"
    ]
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error"
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
      "react-hooks/exhaustive-deps": "error",
      "jsx-a11y/role-supports-aria-props": "error"
    }
  }
];

export default eslintConfig;
