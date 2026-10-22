# 0030 — Search: Postgres full-text, accent-insensitive, no third party
**Status:** Accepted · 2026-10-22
**Context:** Visitors need to find a news item, an event, a guide or a group. The site is small (hundreds of documents),
bilingual, used on mid-range phones over paid data, and must not send queries to a third party.
**Decision:**
1. **Postgres FTS in the existing Neon database**: `to_tsvector('french'|'english', unaccent(text))` against
   `websearch_to_tsquery(…, unaccent(q))`, ranked with `ts_rank`. The `unaccent` extension is enabled by an additive
   migration (0015); « bapteme » finds « baptême ». The language follows the visitor's locale (English falls back to French
   text per document, like the rest of the site).
2. **Only what is public**: live news, published events, published guides, published department pages. Static pages are
   matched by the web app from its own page list. Drafts, scheduled items and unvalidated content are never indexed.
3. **No index tables to keep in sync**: the corpus is small, so the query reads the source tables directly (a union per
   type). If it grows past a few thousand rows, add a stored `tsvector` column and a GIN index per table.
4. **Cheap and safe**: `/api/search?q=` is edge-cached per normalised query (60 s); only cold queries reach the database
   and only those count against a Postgres rate limit (30 per minute per hashed address). Queries are not logged and never
   carry a user id. Excerpts are cut in code and escaped before highlighting.
5. **UI**: `/fr/recherche?q=` is server-rendered (works without JavaScript); the header dialog shows debounced instant
   results and Enter goes to the full page.
**Consequences:** `pg_trgm` (typo tolerance) is deliberately not enabled yet; revisit if people report misses. The search
module lives in the registry package (`modules/search.ts`) because it reads several modules' tables.
