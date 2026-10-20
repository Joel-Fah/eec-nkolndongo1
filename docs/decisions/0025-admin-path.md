# 0025 — The admin's address is configurable (ADMIN_PATH)
**Status:** Accepted · 2026-10-20
**Context:** `/admin/` is the first place anyone tries. Nothing is secret about it (every route is permission-
checked), but a less obvious address avoids accidental visits, noise from scanners and support questions. A
typo in production (`gestion/` vs `/gestion/`) must not take the admin down.
**Decision:** One variable, `ADMIN_PATH` (default `admin`), read from `.env.local` / the Worker vars.
`normalizeAdminPath()` (`@eec/core`, tested) accepts `gestion`, `gestion/`, `/gestion`, `/gestion/` (any case,
nested paths allowed), rejects unsafe characters and words the site uses (`api`, `fr`, `en`, `media`…).
It drives: the admin build (`vite base`, router basepath from `BASE_URL`), the invitation / reset links the API
returns, the bootstrap CLI's link, the dev gateway, and the Worker's single-page-app fallback. At the old
address a non-default admin simply returns the site's normal 404.
**Consequences:** Changing it needs a rebuild of the admin (the base is baked into its assets) and the same
value in the Worker vars. Existing invitation links keep the address they were created with.
