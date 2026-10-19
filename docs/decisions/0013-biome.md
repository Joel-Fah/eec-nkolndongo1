# 0013 — Biome for lint and format
**Status:** Accepted · 2026-10-19
**Context:** One developer, a TypeScript monorepo (Astro, React, Workers), frugal CI. ESLint + Prettier
means two tools, many plugins and slow runs; ARCHITECTURE.md originally listed them as placeholders.
**Decision:** Biome 2 (lint + format + import sorting) with one shared config in `packages/config/biome.json`,
extended by the root `biome.json`. Biome only reads the frontmatter of `.astro` files, so unused-variable
rules are off there and **`astro check`** (the web app's `typecheck` task) covers templates and types.
**Consequences:** One fast binary (lint of the whole repo in ~50 ms), no plugin churn. Some ESLint-only
rules (e.g. React hooks exhaustive deps nuances, a11y JSX plugin depth) are thinner; Biome's own a11y and
React rules cover the essentials. Revisit if a needed rule is missing.
