# 0017 — Single origin: site, admin, API and media on one Worker
**Status:** Accepted · 2026-10-19
**Context:** Sessions are HttpOnly cookies. A `*.workers.dev` hostname is on the Public Suffix List, so two
Workers (site, API) cannot share a cookie, and a cross-origin API would need CORS and `SameSite=None`.
Workers Free also bills one invocation (10 ms CPU) per request, so an extra hop costs twice.
**Decision:** One Worker serves everything on one origin: site `/`, admin `/admin/`, API `/api/*`, media
`/media/*`. The Hono app from `apps/api` is mounted in the web Worker through an Astro endpoint
(`apps/web/src/pages/api/[...path].ts`, `env` from `cloudflare:workers`), not through a service binding. The
admin is built with `base: '/admin/'`; `/admin/*` falls back to the SPA index. Locally, `pnpm dev` starts a
small Node gateway on `:8080` (`/admin` → Vite, everything else → Astro) so cookies behave as in production.
**Consequences:** Cookies are first-party; CSRF is handled by same-origin + `Origin` checks, no CORS.
`apps/api` stays a package that tests run directly with `app.request`. Static pages are still served from
assets without running the Worker. A service binding stays the documented alternative if the API outgrows
the shared Worker. `src/fetch.ts` (Hono as Astro entry) was tried and abandoned: it fails in `astro dev`.
