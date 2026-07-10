# 0027 — Astro Starlight for the public website

**Status:** Accepted

## Context

OhmSweetOhm needed a public-facing website for a landing page and user documentation, separate from the Next.js application itself. The app is not publicly accessible on the internet; it runs self-hosted. The website should be a static site deployable to GitHub Pages.

## Decision

Use [Astro](https://astro.build/) with the [Starlight](https://starlight.astro.build/) theme for the public website. The site lives in `site/` at the repository root as a **standalone pnpm project** — it is not added to the root `pnpm-workspace.yaml`. A dedicated GitHub Actions workflow (`.github/workflows/site.yml`) builds and deploys it to GitHub Pages on every push to `main` that touches `site/**`.

## Rationale

- Starlight provides a documentation-first layout with a landing page (`template: splash`), sidebar navigation, and search out of the box — minimal custom CSS needed.
- Astro produces fully static output suitable for GitHub Pages at zero hosting cost.
- Keeping `site/` standalone (not in the pnpm workspace) means Astro's dependencies stay out of the main `pnpm-lock.yaml` and the main CI (`ci.yml`) is unaffected. Because pnpm delegates installs to the workspace root for non-member directories, `site/` uses npm to manage its own `package-lock.json`.
- GitHub Pages deployment via `actions/deploy-pages` activates automatically on the first successful workflow run — no manual repository settings needed.

## Consequences

- A second `pnpm-lock.yaml` exists under `site/`. Renovate will manage its dependencies independently.
- The site deploy is triggered only when files under `site/**` or the workflow file itself change, keeping deploys fast and focused.
- The `base: '/ohm-sweet-ohm'` config in `astro.config.mjs` ties the site to the `michalwy/ohm-sweet-ohm` repository name. Renaming the repository requires updating this value.
