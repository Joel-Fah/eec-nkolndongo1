# 0027 — How content pages are rendered
**Status:** Proposed · 2026-10-21 (Checkpoint 0 — awaiting approval)
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
**Decision:**
1. Public content pages are rendered on demand (`prerender = false`) and the full HTML is kept in the Workers Cache
   (key = locale + path + content version), fresh a short while, then served stale while a refresh runs on its own
   connection (`cachedResponse`). A hit costs no database call and almost no CPU.
2. Thresholds, re-measured at Checkpoint A on the real news page (cache miss, p95): ≤ 8 ms keep this approach;
   8–10 ms switch to a static shell with cached fragments; > 10 ms stop and ask about Workers Paid (never switch
   plans unasked).
3. A database that is cold or down never produces a 500: stale copy if there is one, else a friendly
   « unavailable » state (HTTP 503, `Retry-After`).
4. Static pages (story, legal when published) stay static.
**Consequences:** Local development against a remote Neon branch is slow on the first request of a page; the
unavailable state is the expected rendering when the network is down. The first live reading on production must
confirm the CPU figures before launch.
