# 0021 — Parish settings on a static site: fresh without a cache purge
**Status:** Accepted · 2026-10-20
**Context:** Contact details, social links and the season come from the admin, but the public pages are
static (fast, free to serve) and must never wait for the database (Neon can be cold or down). We have no
custom domain yet, so no Cloudflare zone and no global cache purge; the Workers Cache API is per data
centre.
**Decision:**
- Pages are built with safe defaults. A ~1 KB script (`apps/web/src/lib/settings-client.ts`) reads
  `/api/settings/public` and fills marked places (footer address, social links) and applies a season
  override or the Fête des Moissons dates. If the API is slow or down, the defaults stay.
- `/api/settings/public` returns **approved values only** (each field has a « validé » flag; an edit by
  someone without `settings:validate` removes it). It is cached at the edge with the Cache API: fresh for
  120 s, then served stale while a background refresh runs; if the database fails, the last good value is
  served for up to 7 days.
- **Content version:** each save bumps `content_versions['settings']`; the version is part of the cache key,
  so a change is picked up within seconds. Reading it is one tiny query at most every 5 s per Worker
  isolate (memoised). KV was considered and rejected: its eventual consistency (up to ~60 s) is slower than
  this read, and it adds a binding for one integer.
**Consequences:** Settings changes appear within seconds to two minutes, with no rebuild and no purge.
The same pattern (`cachedJson` + `contentVersion` in `@eec/api-kit`) serves Phase 03 content. When a domain
and zone exist, purge-by-tag can replace the version key.
