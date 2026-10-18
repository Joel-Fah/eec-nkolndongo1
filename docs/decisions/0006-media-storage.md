# 0006 — Media: R2 + YouTube, Google Drive as archive
**Status:** Accepted · 2026-10-19
**Context:** Neon includes 5 GB object storage but only 5 GB public egress per project on the free plan.
Google Drive is unreliable for serving media (quotas, virus-scan interstitial, poor streaming).
**Decision:** Public files (images, PDFs, audio) → Cloudflare R2 (10 GB free, free egress, CDN).
Video → YouTube with click-to-load facade. Google Drive → archive/backup of originals only.
Neon object storage → not used for public media (may hold small private files if ever useful).
**Consequences:** Upload pipeline must create web-optimised variants before R2.
