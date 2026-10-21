# Decision records

One file per decision: `NNNN-short-title.md` with **Context → Decision → Consequences**. Status:
Proposed · Accepted · Superseded by NNNN. Add a new record instead of rewriting an accepted one.

| # | Decision | Status |
|---|---|---|
| 0001 | Custom build instead of WordPress | Accepted |
| 0002 | Astro for the public site | Accepted |
| 0003 | Vite + React + TanStack for the admin | Accepted |
| 0004 | Neon Postgres rather than Cloudflare D1 | Accepted |
| 0005 | Neon Auth for identity, our own RBAC | Partly superseded by 0018 |
| 0006 | Media: R2 + YouTube, Google Drive as archive | Accepted |
| 0007 | GSAP for motion | Accepted |
| 0008 | Brevo for email (Zoho dropped) | Accepted |
| 0009 | Curated Pexels placeholders, self-hosted | Accepted |
| 0010 | pawaPay for payments (later) | Proposed |
| 0011 | Hugeicons stroke-rounded + Switzer | Accepted |
| 0012 | Frugal CI/CD | Accepted |
| 0013 | Biome for lint and format | Accepted |
| 0014 | Paraglide JS for i18n messages | Accepted |
| 0015 | Brand and type (logo, lockups, Fraunces + Switzer, colours) | Font part superseded by 0023 |
| 0016 | Dual primitives: native Astro on the public site, Base UI in the admin | Accepted |
| 0017 | Single origin: site, admin, API and media on one Worker | Accepted |
| 0018 | Auth: self-hosted Better Auth on our Neon database | Accepted |
| 0019 | No domain, no email: an outbox the secretariat relays | Accepted |
| 0021 | Parish settings on a static site: fresh without a cache purge | Accepted |
| 0023 | Erode replaces Fraunces for headings | Accepted |
| 0024 | Storyset (Cuate) illustrations, recoloured, never committed | Accepted |
| 0025 | The admin's address is configurable (ADMIN_PATH) | Accepted |
| 0027 | How content pages are rendered (on demand + cached HTML) | Proposed |
| 0032 | Bible translations: public domain only (LSG 1910, WEB) | Accepted |
| 0026 | Seasonal playground under the footer | Accepted |
| 0020 | Media storage: S3-compatible, Neon Object Storage first | Accepted |
| 0022 | Backups: encrypted logical dumps, a tested restore | Accepted |
