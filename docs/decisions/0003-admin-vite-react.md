# 0003 — Vite + React + TanStack for the admin
**Status:** Accepted · 2026-10-19
**Context:** Create React App is retired; the admin is behind login (no SEO), used by non-technical staff,
must be modern, bilingual, maintainable.
**Decision:** Vite SPA with React + TypeScript, TanStack Router (typed routes) and Query (server state),
React Hook Form + Zod, Radix/Base UI primitives styled with our tokens.
**Consequences:** No server framework to maintain for the admin; deployed as static assets. Shares tokens
and i18n with the public site.
