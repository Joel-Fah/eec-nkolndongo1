# 0018 — Auth: self-hosted Better Auth on our Neon database
**Status:** Accepted · 2026-10-19 · supersedes the managed-Neon-Auth part of 0005
**Context:** 0005 allowed a fallback to self-hosted Better Auth. We checked managed Neon Auth against our
must-hold rows: standalone backend and non-Next server use are "coming soon"; its cookies cannot be shared
across domains securely; MFA is "coming soon"; the default mail sender cannot send verification links and is
rate-limited; the SDKs are `0.x-beta`.
**Decision:** Better Auth 1.7.11 runs in our API on the Neon `production` and `dev` branches (`neon.ts` has
`auth: false`). Only its core is used (users, sessions, accounts, verifications); roles, groups and
permissions are our own tables (0005 still holds). Specifics:
- **Passwords** are hashed in Postgres (`pgcrypto` bcrypt, cost 10) so the Worker does not spend its 10 ms CPU
  budget. Policy: 10–72 characters, common-password list refused, generic error messages.
- **Sessions:** HttpOnly, SameSite Lax, prefix `eec`. Better Auth's refresh is off; our own sliding expiry
  gives staff 12 h idle / 7 days max and members 30 days.
- **Rate limits:** stored in Postgres (`rate_limit`) with per-route rules; the Cloudflare binding's Free-plan
  availability is unverified.
- **Staff onboarding:** no open sign-up. Single-use invite links (72 h) and reset links (2 h); only the
  SHA-256 is stored. The first super admin comes from `pnpm admin:bootstrap`, email typed at the CLI.
- **Members** sign up on the public site; consents (privacy, news) are unticked and versioned.
**Consequences:** We own upgrades of the Better Auth schema (migrations in their own commits). Measured so far:
the full flows pass on a Neon `dev` branch (unit, integration, browser); laptop timings of 1–3 s per call are
network latency to Frankfurt. **Real Worker CPU is not measured yet**; it needs a deployed Worker and goes in
`PHASE_02_REPORT.md`. If hashing or init exceed 10 ms in production, the fallback is Workers Paid, and we ask
first. Google sign-in is deliberately not enabled pending the owner's answer.
