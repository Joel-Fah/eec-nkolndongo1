# Runbook — running the site

Everything here is meant to be doable by Joël (or the person after) without guessing. Nothing in this file is a secret.

## Where each secret lives (never in git)
| Secret / setting | Local | Production |
|---|---|---|
| `AUTH_SECRET` (session signing; one per environment) | `.env.local` | Cloudflare Worker secret |
| `DATABASE_URL_UNPOOLED` (Neon direct URL) | `.env.local` | GitHub secret (migrations, backups); the Worker uses a Hyperdrive binding |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | `.env.local` | Cloudflare Worker secrets |
| `AWS_*` object storage keys, `MEDIA_BUCKET` | `.env.local` | Worker secrets (media) and GitHub secrets (backups) |
| `BACKUP_AGE_RECIPIENT` (public key) | `.env.local` | GitHub secret |
| age PRIVATE key | — | **offline, with Joël only** |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | — | GitHub secrets (deploy, preview) |
| `ADMIN_PATH`, `SITE_INDEXABLE` | `.env.local` | GitHub repository **variables** (also `vars` in `wrangler.jsonc`) |

## Deploy
1. Merge to `main`: the `deploy` workflow lints, tests, builds (`pnpm build:site` puts the admin inside the site at
   `ADMIN_PATH`), applies migrations to the production Neon branch, then `wrangler deploy`.
2. **Migrations are additive by default.** A destructive one (drop, rename, type change) needs a decision record and
   Joël's explicit OK before merging.
3. Preview without deploying: Actions → `preview` → Run workflow (uploads a version, gives a preview URL).
4. Launch = set the repository variable `SITE_INDEXABLE=1` and redeploy. Until then every page, file and header says
   « noindex », robots.txt disallows everything, and a ribbon says the site is not indexed yet.

## Roll back
Cloudflare dashboard → Workers → `eec-nkolndongo1` → Deployments → pick the previous version → Rollback. Database
migrations are not rolled back by this: write a new forward migration.

## Backups and restore (decision 0022)
- Weekly, automatic (`backup` workflow, Sundays 02:23 UTC), last 12 kept in the `eec-backups` bucket. By hand:
  `pnpm backup` (with the variables in `.env.local`), or `pnpm backup -- --out file.age` for a local copy.
- **Restore drill** (do it once a quarter, and before any risky change):
  1. Create an empty target: a new Neon branch (or an empty database).
  2. `pnpm restore --file latest --target "<target url>" --identity <private key file>`
  3. It must end with « restore verified ». Open the site against that branch to look. Delete the branch.
- Lost the private key = the backups cannot be read. Keep it in two places offline.

## Daily retention
A Cloudflare Cron Trigger (03:17 UTC) runs `apps/api/src/retention.ts`: expired sessions and links, outbox > 90 days,
audit > 24 months, accounts whose deletion was requested > 30 days ago. Each run writes a row in `retention_runs`.
By hand: `pnpm --filter @eec/api retention`.

## Monitoring and limits to watch (Free plans)
Workers: 100 000 requests/day, 10 ms CPU per request. Neon: storage and the 5 GB/month egress shared with the media
bucket (the library shows the space used and warns at 70 %). Check Cloudflare's usage page monthly.

## Incidents
See `docs/ops/incident.md`.
