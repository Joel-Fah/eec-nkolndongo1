# CI/CD — frugal by design

The repo is public, so GitHub Actions minutes are free, but we still keep runs **rare, short and
meaningful**. Content publishing never triggers CI (edge cache purge instead — see ARCHITECTURE §6).

## Rules
1. **No CI on every push.** Feature branches run nothing automatically.
2. **Pull requests to `main`:** one `check` workflow (lint, typecheck, unit tests, build) — only when
   code paths change (`paths-ignore: ['docs/**', '**/*.md', 'assets/images/illustration_references/**']`),
   only when the PR is *ready for review* (skip drafts).
3. **`concurrency` with `cancel-in-progress: true`** on every workflow — a new push cancels the old run.
4. **Deploy on merge to `main`**, path-filtered per app (web / admin / api deploy only if their files or
   shared packages changed). Turborepo `--affected` decides what to build.
5. **Caching:** pnpm store + Turborepo cache. Target: check < 4 min, deploy < 3 min.
6. **Preview deploys are manual** (`workflow_dispatch`), not per-PR.
7. **Scheduled jobs** (retention cleanup, Neon keep-warm if ever needed) run as Cloudflare Cron
   Triggers on the Worker, not GitHub Actions.
8. **No E2E/Lighthouse on every PR.** Run them manually before releases (`release-checklist` skill).
9. Dependabot/Renovate: grouped, **monthly**.
10. Any new workflow or trigger needs a line in this file explaining why.

## Workflows
| File | Trigger | Why |
|---|---|---|
| `.github/workflows/check.yml` | `pull_request` → `main` (ready, code paths only) | Rule 2. Also fetches the Fontshare fonts (cached by script hash) because their licence forbids committing them (see decision 0015). |
| `.github/workflows/deploy.yml` | push to `main` (code paths only) + manual | Rule 4. Lint, test, build (`pnpm build:site`), migrate the production database, `wrangler deploy`. Environment `production`. |
| `.github/workflows/preview.yml` | manual only | Rule 6. Deploys the branch to the separate preview Worker (dev data), never production. |
| `.github/workflows/backup.yml` | weekly (Sunday 02:23 UTC) + manual | The one scheduled GitHub job: a Worker cannot run the database dump. Short (< 2 min); decision 0022. |

Retention (daily) is **not** a workflow: it is a Cloudflare Cron Trigger on the Worker (rule 7).

## Commit & branch flow
`main` (protected, always deployable) ← short-lived `feat/*`, `fix/*` branches ← squash merge.
Releases tagged `vYYYY.MM.N` when a phase milestone ships.
