# 0012 — Frugal CI/CD
**Status:** Accepted · 2026-10-19
**Decision:** Follow `docs/ops/ci-cd.md`: checks only on ready PRs touching code, path-filtered deploys
on merge to `main`, concurrency cancellation, manual previews, schedules on Cloudflare Cron.
