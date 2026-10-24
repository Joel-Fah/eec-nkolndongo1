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

## First deploy (by hand, once)
`bash scripts/ops/first-deploy.sh` — reads `.env.production.local` into the shell only, checks the branch and database,
asks you to type DEPLOY, then builds, migrates and seeds the production database, deploys the Worker and sends its
secrets. Afterwards `pnpm admin:bootstrap` (with the same environment loaded) creates the super admin through a single-use
link. From then on, merges to `main` deploy through the `deploy` workflow.

## Deploy
1. Merge to `main`: the `deploy` workflow lints, tests, builds (`pnpm build:site` puts the admin inside the site at
   `ADMIN_PATH`), applies migrations to the production Neon branch, then `wrangler deploy`.
2. **Migrations are additive by default.** A destructive one (drop, rename, type change) needs a decision record and
   Joël's explicit OK before merging.
3. Preview: Actions → `preview` → Run workflow. It deploys the branch to a **separate** Worker (`eec-nkolndongo1-preview`, see « Safe preview »), never touching production's data.
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

## Telling dev from production in your terminal
- A normal terminal only ever has the **dev** values (`.env.local`). Production values live in `.env.production.local`
  and are loaded only inside `bash scripts/ops/prod-shell.sh`: a shell with a red **PROD** prompt, closed with `exit`.
- Commands that change data (`db:migrate`, `db:seed`) ask you to **type the branch name** when it is not `dev`.
  `clean:test-data` and the spike refuse anything but `dev`. CI deploys without the prompt (it is the intended path).
- Check before acting: `echo $NEON_BRANCH` (dev / production).

## Safe preview (separate Worker, dev data)
A version of the production Worker would reuse production's secrets and database, so previews run on their own Worker,
`eec-nkolndongo1-preview` (built with `PREVIEW_WORKER=1`: no Hyperdrive, no cron, always noindex). One-time setup, once the
Worker exists (first run of the `preview` workflow creates it): set its secrets **from your dev values** (`.env.local`), never
production's: `wrangler secret put <NAME> --name eec-nkolndongo1-preview` for `AUTH_SECRET` (a new value), `DATABASE_URL_UNPOOLED`
(the dev Neon branch), the `AWS_*`/`MEDIA_BUCKET` keys (the dev bucket). Then the preview URL is
`https://eec-nkolndongo1-preview.<your subdomain>.workers.dev`. Check with the admin « Système » screen that the database name is dev.

## Media second copy (R2)
`pnpm media:sync` copies the media files to a Cloudflare R2 bucket (only new ones, never deletes). The weekly `backup`
workflow runs it once these GitHub secrets exist: `MEDIA_COPY_ENDPOINT` (`https://<account id>.r2.cloudflarestorage.com`),
`MEDIA_COPY_BUCKET`, `MEDIA_COPY_ACCESS_KEY_ID`, `MEDIA_COPY_SECRET_ACCESS_KEY` (an R2 API token with object read/write).

## End-to-end check (by hand, never in CI)
`pnpm dev` running, then `pnpm e2e` (needs the dev test account; `E2E_EMAIL` / `E2E_PASSWORD` override it). It publishes
and schedules a post, checks a recurring event with a cancelled date in the `.ics` feed, sends contact messages (including
the spam traps and the missing consent) and checks the inbox, and finds the post through search. It runs against a local
stack only and removes what it creates. A scheduled post takes about 2 minutes (cache time).

## Content still waiting for validation
`pnpm content:pending` lists every public place waiting for validated content (the `À VALIDER` markers and the database
flags) and writes `docs/content/PENDING.md` (generated, not committed). Run it against production (when it is lifted) to
send the list to the content partner.

## Daily retention
A Cloudflare Cron Trigger (03:17 UTC) runs `apps/api/src/retention.ts`: expired sessions and links, outbox > 90 days,
audit > 24 months, accounts whose deletion was requested > 30 days ago. Each run writes a row in `retention_runs`.
By hand: `pnpm --filter @eec/api retention`.

## Santé, visit counts, validation (Phase 04a)
- **Admin → Santé** (`core:system-health`): the daily cron also records a health row (database answer time, bucket reachable,
  last backup age, outbox backlog, database size, files size; orange from 70 % of a free limit). « Vérifier maintenant » runs it
  on demand. The backup workflow writes the « last backup » mark (`system_marks`); until its first run after this version
  the backup shows orange « aucune sauvegarde enregistrée ». Neon egress and Workers requests/day cannot be read by the
  Worker: read them in the Neon console and the Cloudflare dashboard (monthly).
- **Visit counts** (decision 0038): Analytics Engine was enabled by Joël (2026-10-22), `deploy.json` names the dataset `analytics_events` and the account. **Still to do by Joël: set the Worker secret `CF_ANALYTICS_TOKEN`** (step 5). The dataset appears in the dashboard only after the first deploy writes data. Original steps, for the record:
  1. Dashboard → **Workers & Pages → Analytics Engine** (in the left menu, under « Workers & Pages » or « Storage & databases »):
     enable it if it asks, and **note the plan it shows** (Free is expected: 100 000 points a day). If it asks for a card or an
     upgrade, **stop and tell me**: we leave it dormant.
  2. Pick a dataset name, for example `eec_visits` (it is created by the first write; nothing to create by hand).
  3. Dashboard → right column of any page (or the URL `dash.cloudflare.com/<id>`): copy the **Account ID** (a 32-character id; not a
     secret).
  4. Put both in `apps/web/deploy.json` (`"analyticsDataset": "eec_visits"`, `"accountId": "<id>"`) and merge (I can do this).
  5. My Profile → **API Tokens → Create token → Custom token**: permission **Account · Account Analytics · Read**, scoped to this
     account only. Copy it once and set it: `pnpm --filter @eec/web exec wrangler secret put CF_ANALYTICS_TOKEN --config
     dist/server/wrangler.json` (or in the Worker's *Settings → Variables and Secrets* as a secret).
  6. After the next deploy, open the admin home: the « Visites » section fills in from the next day. Without step 1 do **not** set
     the dataset: a binding to a service the account has not enabled fails the deploy.
- **Validator role**: after a deploy that adds permissions, run `pnpm db:seed` in `prod-shell.sh` (idempotent: new permissions
  and the « Validateur de contenu » role), then grant the role on **Rôles / Utilisateurs** with Joël. The role sees **À valider**.
- **Share cards** (`apps/web/public/og/*.jpg`): redrawn by `node scripts/og-generate.ts` (needs Chrome and playwright-core) when
  the parish name or tagline changes; commit the result.
- **Structured data check**: `node scripts/jsonld-check.ts <base url>`, then Google's Rich Results Test (see `launch.md`).

## Monitoring and limits to watch (Free plans)
Workers: 100 000 requests/day, 10 ms CPU per request. Neon: storage and the 5 GB/month egress shared with the media
bucket (the library shows the space used and warns at 70 %). Check Cloudflare's usage page monthly.

## Incidents
See `docs/ops/incident.md`.
