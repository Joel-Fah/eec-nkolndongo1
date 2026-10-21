#!/usr/bin/env bash
# The first production deploy, run by hand by the person in charge (Joël), from the repo root:
#     bash scripts/ops/first-deploy.sh
# It reads .env.production.local (gitignored) into THIS shell only, prints no secret, and asks you to type DEPLOY.
# Steps: check → build (admin inside the site) → migrate + seed the production database → deploy the Worker →
# send the Worker's secrets → remind you of the last manual steps. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/../.."

ENV_FILE=.env.production.local
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE"; exit 1; }
set -a; . "./$ENV_FILE"; set +a
# The live address, whatever the env file says: links the API and the bootstrap create must point here.
export APP_ORIGIN="https://eec-nkolndongo1.joelfah2003.workers.dev"

host() { node -e "console.log(new URL(process.env[process.argv[1]] ?? '').host)" "$1" 2>/dev/null || echo "(not set)"; }
echo "Neon branch : ${NEON_BRANCH:-?}"
echo "Database    : $(host DATABASE_URL_UNPOOLED)"
echo "Storage     : $(host AWS_ENDPOINT_URL_S3)"
echo "Admin path  : ${ADMIN_PATH:-admin}"
echo "Indexable   : ${SITE_INDEXABLE:-0}  (0 = closed to search engines)"
case "$NEON_BRANCH" in production|main) ;; *) echo "NEON_BRANCH must be production or main. Stopping."; exit 1 ;; esac
case "$(host DATABASE_URL_UNPOOLED)" in *-pooler*) echo "The database string is the pooled one. Stopping."; exit 1 ;; esac
[ -n "${AUTH_SECRET:-}" ] || { echo "AUTH_SECRET is empty. Stopping."; exit 1; }
read -r -p "Type DEPLOY to continue: " answer
[ "$answer" = "DEPLOY" ] || { echo "Cancelled."; exit 1; }
export SITE_INDEXABLE="${SITE_INDEXABLE:-0}"
export EEC_CONFIRMED=1 # the DEPLOY confirmation above covers the database commands below

echo "── 1/5 build"
pnpm install --frozen-lockfile
pnpm fonts:fetch
pnpm illos:fetch
pnpm build:site

echo "── 2/5 production database: migrations and permissions"
pnpm db:migrate
pnpm db:seed

echo "── 3/5 deploy the Worker"
pnpm --filter @eec/web exec wrangler deploy --config dist/server/wrangler.json

echo "── 4/5 Worker secrets"
tmp="$(mktemp)"
trap 'shred -u "$tmp" 2>/dev/null || rm -f "$tmp"' EXIT
node -e "
const keys = ['AUTH_SECRET','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','AWS_ENDPOINT_URL_S3','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_REGION','MEDIA_BUCKET'];
const out = {}; for (const k of keys) if (process.env[k]) out[k] = process.env[k];
require('fs').writeFileSync(process.argv[1], JSON.stringify(out));
console.log('secrets to send:', Object.keys(out).join(', '));
" "$tmp"
pnpm --filter @eec/web exec wrangler secret bulk "$tmp" --config dist/server/wrangler.json

echo "── 5/5 done"
echo "Site  : https://eec-nkolndongo1.joelfah2003.workers.dev"
echo "Admin : https://eec-nkolndongo1.joelfah2003.workers.dev/${ADMIN_PATH#/}" | sed 's#//$#/#'
echo "Next  : create your super admin on the production database:  pnpm admin:bootstrap"
echo "        (it prints a single-use invitation link; open it and choose your password)"
