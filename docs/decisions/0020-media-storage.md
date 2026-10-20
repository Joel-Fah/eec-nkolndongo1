# 0020 — Media storage: S3-compatible, Neon Object Storage first
**Status:** Accepted · 2026-10-20
**Context:** The library needs a bucket. Cloudflare R2 needs a payment method at sign-up (not now); Neon Object
Storage is S3-compatible, in beta, 5 GB on the Free plan (egress shared with Postgres), in the same region as the
database.
**Decision:** One S3-compatible driver (`aws4fetch`, ~1 KB, SigV4 on `fetch`, no AWS SDK in the Worker) configured
by `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` and `MEDIA_BUCKET`. Moving to R2 =
change those variables and copy the objects. Files leave only through `/media/<key>` (Worker: Range, ETag,
immutable cache, edge cache for images and PDFs to spare the egress); the bucket is never public.
Photos are processed **in the browser** (Web Worker, `OffscreenCanvas`): upright, resized, re-encoded
(WebP; JPEG where WebP encoding is missing, e.g. Safari), which removes all metadata by construction; a
ThumbHash is computed. No WASM encoder dependency for now (revisit jSquash/AVIF if Safari quality or size
matters). The API checks files by their first bytes and size, audio and PDF stream through without being held in
memory. The Free plan's 5 GB is shown as a meter in the admin (warning at 70 %).
**Consequences:** Neon's buckets are per branch (the dev branch has its own). Beta service: keep the
abstraction, watch egress. Lifecycle rules are not enforced by Neon: cleanup is ours (retention Cron).
