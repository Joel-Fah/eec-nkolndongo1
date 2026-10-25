---
name: owasp-security
description: Security review for EEC Nkolndongo 1 following the OWASP Top 10, mapped to this repo's real controls (guards, route-table test, scope matrix, CSP, rate limits, audit). Use when adding a route, upload, data field or integration, and before every release.
---

# Security review (OWASP Top 10)

Run on any new **route**, **upload**, **kind of personal data**, **third-party call**, or before a release (`release-checklist`).
Write findings as `file:line — risk — fix`. Anything touching production, secrets or a new kind of personal data: **stop and ask Joël**.

## A01 Broken access control
- [ ] Every POST/PUT/PATCH/DELETE starts with `requirePermission`, `requirePermissionAnywhere` (then `mayOn` on the exact group), `requireSelf` or `publicRoute('why')` (`packages/api-kit/src/guards.ts`). `apps/api/src/routes.test.ts` fails otherwise and pins the list of public mutations.
- [ ] Group-scoped modules: a grant for group A never opens group B or the parish (`modules/scope.test.ts`, matrix per module).
- [ ] Private data (Mon espace, Moissons for members, photos, notifications) is `private, no-store`, `noindex`, and in the service worker's `PRIVATE` list (`apps/web/src/sw/sw.js`, `sw-rules.test.ts`).
- [ ] A person acts only on their own rows (`userId` from the session, never from the body). IDs in URLs are checked against the actor.
- [ ] Proposed or unvalidated data counts nowhere until validated (0045); a validator cannot validate their own entry (campaigns 0041).

## A02 Cryptographic failures
- [ ] Secrets only in `.dev.vars` / `.env.local` / Cloudflare and GitHub secrets, never in git (the repo is public). Do not read or print them.
- [ ] Tokens are HMAC-signed and expiring (`signPreview`, fill-time token, registration and cancellation links); passwords are hashed by Better Auth; IPs are salted hashes.
- [ ] HTTPS only (HSTS in `packages/api-kit/src/security-headers.ts`); no sensitive value in a URL or log.

## A03 Injection
- [ ] Queries go through Drizzle; raw `sql` uses bound parameters (never string-built), and reads another module's table by name only.
- [ ] Request bodies are parsed with zod `.strict()` with length caps and enums; dates and numbers are validated (`validation.test.ts`).
- [ ] Output is escaped (Astro/React default). `dangerouslySetInnerHTML` / `set:html` only on our own registry or sanitised content; the markdown renderer escapes first.
- [ ] CSV exports neutralise formulas (`csvCell`).

## A04 Insecure design
- [ ] New personal data has a decision record, a purpose per field, an entry in `docs/legal/data-protection.md` and the member README **before code** (Loi n°2024/017).
- [ ] Minimum data, explicit unticked consent, retention stated; sensitive pastoral records are out of scope without an approved decision.
- [ ] Money and attendance are aggregates with no donor or person; the audit log carries no amounts, counts or secrets.
- [ ] Abuse cases considered: rate limit on public forms (`packages/auth/src/limit.ts`), honeypot and signed fill time, caps on counts and sizes.

## A05 Security misconfiguration
- [ ] CSP and headers come from `security-headers.ts` (kept honest by `security-headers.test.ts`); no new third-party domain on a public page without Joël's OK.
- [ ] `sameOrigin` stays mounted on `/api/*` (CSRF); cookies are `HttpOnly`, `Secure`, `SameSite`.
- [ ] `SITE_INDEXABLE` is **never** set by us; the preview Worker points at dev data only; no debug route or verbose error in production.
- [ ] Buckets are never public; files leave only through the checked media route (or a session-checked private route).

## A06 Vulnerable and outdated components
- [ ] No dependency without a reason (CLAUDE.md « useful before impressive »); versions pinned (catalog); run `pnpm audit` before a release and read what it reports.
- [ ] Prefer a small hand-written piece to a library for tiny jobs (service worker, pickers, charts).

## A07 Identification and authentication failures
- [ ] Better Auth settings: rate limits on sign-in, sign-up, reset and change-password; staff sessions 12 h idle / 7 days max; reset and invite links single-use and expiring.
- [ ] Sign-in answers never reveal whether an email exists; passwords have length rules and no composition traps.
- [ ] Staff accounts use strong passwords; deactivated users lose access at once (session revoked).

## A08 Software and data integrity failures
- [ ] CI stays frugal and pinned (`docs/ops/ci-cd.md`); no workflow trigger added without reading it; lockfile committed.
- [ ] Migrations are additive in their own commits; destructive ones need a decision and Joël's OK; a Neon backup branch before any production migration.
- [ ] The service worker is build-stamped and drops old caches; it never keeps private or `no-store` responses.
- [ ] Uploads: magic-byte sniffing, size caps, metadata stripped in the browser, content type set by us.

## A09 Security logging and monitoring failures
- [ ] Sensitive actions are audited (`audit()`): role changes, exports (by row count), validation, deletion, photo or consent changes; entries carry no secret, amount or personal value.
- [ ] `Santé` (system health) and the outbox are checked; `docs/ops/incident.md` (Stop, Understand, Tell, Fix) is current.

## A10 Server-side request forgery
- [ ] The server never fetches an address a user typed. Links people enter (sermons, bulletin PDF) are stored and shown as `https` links only, with their host visible; embeds are click-to-load facades.
- [ ] Any new outbound call goes to a fixed, known host and is listed in the CSP and the data-protection notes.

## Commands
```bash
pnpm test                 # route-table, scope matrix, boundaries, validation, headers
pnpm check --concurrency=2
pnpm e2e                  # against a local stack only; checks privacy of validated-only totals, notifications, etc.
pnpm audit
```

## Report template
```
Scope: <route / feature>        Date:
Findings: A0x file:line — risk (High/Med/Low) — fix
Tests added or run:
Open questions for Joël:
```
