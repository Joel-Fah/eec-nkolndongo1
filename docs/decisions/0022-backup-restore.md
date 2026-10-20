# 0022 — Backups: encrypted logical dumps, a restore we have tested
**Status:** Accepted · 2026-10-20
**Context:** A backup kept in the same Neon project is not a backup, and one never restored is a hope. No `pg_dump`
in the environment we control (CI and laptops differ), and the schema already lives in the repo's migrations.
**Decision:** `pnpm backup` dumps every table of `public` (except sessions, tokens and rate-limit counters) as
NDJSON, gzips it and encrypts it with **age** for a PUBLIC recipient key; the file goes to the `eec-backups`
bucket, the last 12 are kept. It runs weekly from a GitHub Action (a Worker cannot run it; the one exception to
« schedules run on Cloudflare ») and by hand. The **private key stays offline** with Joël (never in git, CI or
Cloudflare). `pnpm restore --file <backup|latest> --target <url> --identity <key>` restores into an EMPTY database:
it refuses a non-empty target and the live database, applies the repo's migrations, loads rows in foreign-key order
and checks every table's row count against the backup's header.
**Tested (2026-10-20):** dev branch backed up (8 KB, 19 tables), restored into a fresh database on the same
project: schema created from the migrations, every table's count identical; a second restore into it refused
(not empty); the scratch database was then dropped.
**Consequences:** The Neon bucket is the second copy only for the database; **media files have no second copy yet**
(R2 or a periodic copy to Google Drive, to decide). Neon's own point-in-time restore remains the first line of
defence (Free: 6 hours). A copy of the newest backup on Joël's Google Drive is recommended monthly.
