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
| 0020 | Media storage: S3-compatible, Neon Object Storage first | Accepted |
| 0021 | Parish settings on a static site: fresh without a cache purge | Accepted |
| 0022 | Backups: encrypted logical dumps, a tested restore | Accepted |
| 0023 | Erode replaces Fraunces for headings | Accepted |
| 0024 | Storyset (Cuate) illustrations, recoloured, never committed | Accepted |
| 0025 | The admin's address is configurable (ADMIN_PATH) | Accepted |
| 0026 | Seasonal playground under the footer | Accepted |
| 0027 | How content pages are rendered (on demand from cached JSON) | Accepted |
| 0028 | Rich text: a restricted block schema, cleaned on every save | Accepted |
| 0029 | Events: structured recurrence, exceptions, own RFC 5545 writer | Accepted |
| 0030 | Search: Postgres full-text, accent-insensitive, no third party | Accepted |
| 0031 | Names and photos of people: public only with a recorded consent | Accepted |
| 0032 | Bible translations: public domain only (LSG 1910, WEB) | Accepted |
| 0033 | Legal documents are versioned; members told when the policy changes | Accepted |
| 0034 | Sermon audio: no hosting and no processing on the site; links only | Accepted |
| 0035 | Registrations: what is collected, from whom, for how long | Accepted |
| 0038 | Visit counts without tracking (Analytics Engine), off until enabled | Accepted |
| 0039 | Home texts and key figures are content slots | Accepted |
| 0040 | A role and a screen for the content partner to validate and comment | Accepted |
| 0037 | PWA: manifest and a small hand-written service worker, nothing private cached | Accepted |
| 0041 | Campaigns (Moissons): validated totals only, entered and validated by two people | Accepted |
| 0042 | The Moissons page: members only, in season, one immersive story | Accepted |
| 0043 | Sunday reports: attendance and offerings as aggregates, two roles | Accepted |
| 0044 | In-app notifications, and reports on days that are not Sundays | Accepted |
| 0045 | Proposed Sunday figures: the editor proposes, the secretariat and the treasurer validate | Accepted |
| 0046 | A person can silence a kind of notification | Accepted |
| 0047 | Member profile details, a private photo, and the virtual member card | Accepted |
