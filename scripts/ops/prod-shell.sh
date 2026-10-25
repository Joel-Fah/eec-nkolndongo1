#!/usr/bin/env bash
# Opens a clearly marked PRODUCTION shell: the production variables (.env.production.local) are loaded in it, the
# prompt turns red and says PROD, and they disappear when you type `exit`. Use it for the few commands that must run
# against production (admin:bootstrap, a manual backup or restore drill). Everything else: a normal terminal, which
# only ever sees the dev values in .env.local.
#     bash scripts/ops/prod-shell.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
[ -f .env.production.local ] || { echo "Missing .env.production.local"; exit 1; }
rc="$(mktemp)"
cat > "$rc" <<'RC'
[ -f ~/.bashrc ] && . ~/.bashrc
set -a; . ./.env.production.local; set +a
export APP_ORIGIN="https://eec-nkolndongo1.joelfah2003.workers.dev"
export PS1='\[\e[1;37;41m\] PROD \[\e[0m\] \[\e[1;31m\]'"$NEON_BRANCH"'\[\e[0m\] \w \$ '
echo "PRODUCTION shell: branch $NEON_BRANCH. Commands here touch the live site. Type exit to leave."
RC
trap 'rm -f "$rc"' EXIT
bash --rcfile "$rc" -i
