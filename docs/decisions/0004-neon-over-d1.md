# 0004 — Neon Postgres rather than Cloudflare D1
**Status:** Accepted · 2026-10-19
**Context:** Joël asked whether Cloudflare D1 (SQLite) would be better than Neon (Postgres).
D1 pros: same platform as the Workers, no cold start, generous free reads, no connection management.
Neon pros: full Postgres (rich types, JSONB, constraints, CTEs, full-text search incl. French), managed
auth (Neon Auth, 60k MAU free), branching per environment, portability to any Postgres host.
Neon cons: free compute suspends after 5 min idle (short wake-up on next query); 1 GB storage/project;
5 GB public egress/project.
**Decision:** Neon. The public site is mostly prerendered/edge-cached, so cold starts mostly affect
admins, which is acceptable. Connect via Hyperdrive or Neon's serverless driver.
**Consequences:** Keep public media off Neon (see 0006). Drizzle keeps the schema portable; switching to
D1 later would mean revisiting Postgres-specific features, so we keep those deliberate.
