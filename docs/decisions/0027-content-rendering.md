# 0027 — How content pages are rendered
**Status:** Accepted · 2026-10-21 (approved at Checkpoint 0; figures updated at Checkpoint A)
**Context:** News, events, schedule and the home page change without a deploy, so they cannot be fully static. The
Workers Free plan allows ~10 ms of CPU per request, and the database may be cold or unreachable.
**Measured (local workerd, warm, Free-plan limits not enforced; wall time over-estimates CPU):**
| Request | p50 | p95 |
|---|---|---|
| Static page `/fr/` (asset) | 10.2 ms | 26.5 ms |
| On-demand page, real layout + 10 cards, FR | 12.3 ms | 15.5 ms |
| Same, EN | 12.0 ms | 16.1 ms |
Rendering 10 cards through the real layout adds ≈ 2 ms over a static asset. Database-backed numbers could not be
taken: this machine's link to the dev Neon branch was timing out (earlier it needed 2.5–4 s for a cold connection).
Production uses Hyperdrive, so its figures need a live reading (deferred, production is paused).
**Found while measuring:** every « cache hit » of the public JSON endpoints still opened a database connection to read
the content version, so a hit was as slow as a miss. Fixed: the version is memoised per isolate and a connection is
opened only when the memo expired (`versionFor`), with a 1.5 s limit.
**Checkpoint A figures (real news pages, local workerd, warm, wall time over HTTP; static `/fr/` = 9 ms of that is
the harness):** news list 16 ms p50 / 19 ms p95, news post 14 / 17 ms, `/api/news/public` hit 7 / 8.5 ms. So a hit
costs ≈ 5–7 ms over a static file. A cache miss could not be isolated from the 2–3 s round trip to the dev database
from this machine; the live reading on production (Hyperdrive) is still to do when production work resumes.
Public JS is 12 KB gzipped per page; first load 205–295 KB total (images included, 3rd-party requests: 0).
**Decision:**
1. Public content pages are rendered on demand (`prerender = false`) from the **edge-cached JSON** of the public API
   (key = locale + page + content version), fresh a short while, then served stale while a refresh runs on its own
   connection (`cachedResponse`). A hit costs no database call and ≈ 5–7 ms. (HTML itself is not cached: rendering
   ten cards is ≈ 2 ms, caching it would add invalidation for no gain. Revisit if a page ever renders slowly.)
   The home page stays a static file and fills « Dernières nouvelles » with a tiny client script.
2. Thresholds, re-measured at Checkpoint A on the real news page (cache miss, p95): ≤ 8 ms keep this approach;
   8–10 ms switch to a static shell with cached fragments; > 10 ms stop and ask about Workers Paid (never switch
   plans unasked).
3. Nothing on the request path opens a database connection when it does not have to: the content version and the
   module flags are remembered a few seconds per Worker instance, and a failed lookup is remembered 3 s (one wait,
   not one per request). The time-box is 1.5 s behind Hyperdrive, 8 s for a direct dev connection.
   A database that is cold or down never produces a 500: stale copy if there is one, else a friendly
   « unavailable » state (HTTP 503, `Retry-After`).
4. Static pages (story, legal when published) stay static.
**Consequences:** Local development against a remote Neon branch is slow on the first request of a page; the
unavailable state is the expected rendering when the network is down. The first live reading on production must
confirm the CPU figures before launch.
