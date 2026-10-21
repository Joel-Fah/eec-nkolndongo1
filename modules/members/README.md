# Module `members` — Membres

**Purpose.** The admin side of member accounts: a searchable list, read-only records, a CSV export, and the
headcount shown on the dashboard. Sign-up, sign-in and « Mon espace » (profile, consents, copy of my data,
deletion with a 30-day grace period) are the public side (`apps/api` `members` / `me` routes, `AccountView`).

**Data kept.** Nothing of its own: it reads `user`, `profiles` (first and last name, optional phone, language,
status), `consents` (privacy and news, with policy version and dates) and `group_members`.

**Why each field.** Name and email: to know who has an account. Phone: optional, only if the person gave it.
Groups: what the person says they take part in. Consents: proof of agreement (Loi n°2024/017).

**Exposure.** Admin only. `members:read` (list, records, aggregate numbers), `members:export` (sensitive: CSV
with names, emails and phones; every export is audited). The dashboard numbers are aggregates, with no names.

**Retention.** The account is kept while active. After a deletion request it is purged after 30 days by the
daily retention job (`apps/api/src/retention.ts`). Audit entries are kept 24 months.

**Owners.** Secrétariat (read), super admin (export).
