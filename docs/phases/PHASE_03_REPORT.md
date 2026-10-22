# Phase 03 — Parish Life: report

Branches: `feat/phase-03a-content-time` (Checkpoint 0, content kit, A, B — approved) and `feat/phase-03b-people-pages`
(C, D). Status: **Checkpoint D built, waiting for Joël's review.** Nothing was deployed or migrated on production; all
database work ran on the `dev` branch (migrations 0006–0017, all additive, each in its own commit).

## What was built
- **Content kit**: rich text with a restricted schema (decision 0028), lifecycle (draft / scheduled / published / archived,
  revisions, preview links), cache with stale-while-revalidate and a cold-database time-box (0027), TipTap editor (lazy,
  fullscreen mode, table size picker), media picker, guarded dialogs.
- **Modules**: `news`, `events` (recurrence, exceptions, `.ics` feed — 0029), `schedule` (rhythms, anchored slots, moved dates),
  `liturgy` (Sundays, dial, verses — 0032), `departments` (group pages inside the Groups screen, quiz), `guides` (checklist),
  `story` (page slots, « Gravir la colline », council — 0031), `contact` (form + inbox), `legal` (versioned documents — 0033).
  Giving is a settings section (« Donner », per-field approval); Nous trouver uses approved coordinates.
- **Cross-cutting**: search (Postgres FTS, 0030), admin « À faire », member notice when the privacy policy changes, public
  filters that swap in place, `pnpm content:pending`, `pnpm e2e`.
- Every new component is documented in `/_brand`; decisions 0027–0033 written; ARCHITECTURE, CLAUDE, roadmap, runbook,
  `new-module` skill and `data-protection.md` updated.

## Measurements (local workerd + dev Neon branch; throttled Chrome: 4G, CPU ×4, 412 px phone)
First-load weight, gzip, per page (JS budget ≤ 100 KB, first load ≤ 250 KB excluding lazy media):

| Page | JS | CSS | Fonts | HTML | Media (lazy) | Total |
|---|---|---|---|---|---|---|
| Home | 15.2 | 21.7 | 99.6 | 37.0 | 25.9 | 203.1 |
| News list | 14.8 | 20.1 | 72.7 | 42.2 | 148.3 | 299.7 (151.4 without media) |
| Article | 13.8 | 17.3 | 72.7 | 34.1 | 31.6 | 171.1 |
| Agenda | 14.8 | 21.7 | 72.7 | 35.4 | 0 | 146.2 |
| Event | 13.8 | 18.5 | 72.7 | 32.9 | 0 | 139.4 |
| Horaires | 13.8 | 22.7 | 99.6 | 34.8 | 0 | 172.5 |
| Ce dimanche | 13.8 | 18.7 | 99.6 | 29.3 | 22.4 | 185.4 |
| Année liturgique | 13.8 | 24.4 | 99.6 | 34.8 | 0 | 174.6 |
| Départements | 15.7 | 22.7 | 72.7 | 40.4 | 148.3 | 301.5 (153.2 without media) |
| Page d'un département | 13.8 | 17.3 | 72.7 | 34.2 | 31.6 | 171.1 |
| Guide | 13.8 | 17.3 | 72.7 | 32.5 | 0 | 138.0 |
| Notre histoire (GSAP) | **58.4** | 23.8 | 72.7 | 40.7 | 123.6 | 320.9 (197.3 without media) |
| Donner | 13.8 | 22.7 | 99.6 | 34.0 | 0 | 171.7 |
| Recherche | 13.8 | 17.3 | 72.7 | 29.5 | 0 | 134.9 |

All pages are within the JS and first-load budgets; GSAP is loaded only on Notre histoire. CLS is 0.000 everywhere; no
third-party request on any page.

**LCP (< 2.5 s target) is not proven.** With warm caches the harness gives 2.4 s (guide, text only), 2.8 s (agenda),
3.0 s (article), 5.8 s (a department page whose cover comes from the remote dev bucket); the first cold visit of a page is
much slower because the dev database answers in 2–10 s. These numbers include the preloader and the remote Neon bucket, so
they overstate production; **the real reading must be taken on production once it is lifted** (and the preloader's cost on
LCP looked at then).

**Server time, cache hit** (warm wall-clock through local workerd, 40 requests; not Worker CPU): p50 11–18 ms, p95 13–54 ms
on every page and 6.7 ms / 11.5 ms for `/api/search`. A cold page (cache miss with a cold database) took 2–5 s here.
Worker CPU on production is still to be read (carried over from Checkpoint 0).

**Neon egress estimate.** Public JSON payloads are small (news 3.7 KB, events 10.5 KB, schedule 16 KB, departments 3.5 KB,
story 3.6 KB, guides 0.2–1.7 KB, legal 1.2 KB, settings 0.4 KB). The database is read only on cache misses (60–120 s per key),
so at steady state ≈ 0.2–0.5 MB of database egress per 1 000 visits, and never more than about 0.2 GB per day however busy the
site is (≈ 12 keys × 720 refreshes × ~15 KB). **The larger risk is media**: photos leave through `/media/<key>` from the
bucket (decision 0020: egress shared with Postgres on the Free plan); they are edge-cached, so watch it after launch.

## Resilience (database unreachable)
Local workerd with a fresh cache and the database pointed at a closed port: 16 content pages (news list/article, agenda,
horaires, Ce dimanche, départements and a department, guides and a guide, Notre histoire, Pasteurs et Conseil, Nous trouver,
Donner, recherche, confidentialité, home) all answered **200** in under 0.1 s with the friendly `<UnavailableState>` or their
built-in text; `/api/search` answered a clean 503 `unavailable`. No 500.

## Checks run
- `pnpm check` (lint, typecheck, test, build) green — 78 tasks. Route-table test updated for the one new public mutation
  (`POST /api/contact/submit`); module-boundary test green; scoped-permission tests for departments (one group's leader cannot
  edit another's); hostile-input tests for the rich-text renderer; schema tests for contact (consent, honeypot field,
  lengths), legal and story.
- `pnpm e2e` (by hand): publish → visible, schedule → visible later, event recurrence + cancelled date in the `.ics`, contact
  (too fast refused, honeypot quietly dropped, missing consent refused, real message in the inbox), search finds the post.
  **9 of 9 passed.**
- Contact spam traps and the sensitive flag verified through the API; the sensitive flag's access rule (only
  `contact:read-sensitive`) is in the code and its filters but has no dedicated automated test yet.

## Deviations from the brief
- Departments are edited from the **Groups** screen (one place for people, rights and the public page), by Joël's request;
  the quiz editor is there too. The module has no menu entry of its own.
- Giving is a **settings section** rather than its own module (the brief says « settings-like section »).
- `story` is the name of the pages module (the id `pages` collided with the static page messages).
- The home hero texts, invitation card and key figures are **not yet slots**: they remain in `lib/stats.ts` / messages
  (unvalidated figures are still hidden in production). Proposed next step.
- The contact form's minimum fill time uses a client-supplied timestamp (a bot can fake it); the honeypot, the rate limit and
  the consent are the real protections. A signed timestamp is a small follow-up if spam appears.
- Search reads the source tables directly (no stored `tsvector`); fine for hundreds of documents (0030).
- Retention for contact: besides « 12 months after handled » / « prayer 3 months after handled », a hard cap after receipt
  (24 / 6 months) so an unhandled message does not stay forever.

## Known issues / not done
- **No TalkBack (screen reader) pass and no full keyboard audit** of the editor, calendar, publish dialog, dial, quiz, checklist and
  search dialog were done; the native `<dialog>`/`<details>`/labelled controls are used throughout, but a real pass on a phone is
  still owed (carried over from Phases 01–02).
- The tap-to-dial merchant link (`tel:` with `#` as `%23`) and `geo:` links are untested on a real Android phone.
- `.ics` feed not yet imported in Google Calendar / iOS (needs a public URL).
- Policy-version changes reach other Worker instances within a minute (in-memory memo).
- R2 second copy (`MEDIA_COPY_*` secrets), `PEXELS_API_KEY` as a production secret, safe preview workflow, new permissions /
  « Pasteur » role to grant on existing databases (Rôles screen), verse wording check against a printed LSG/WEB.

## Content still waiting for validation
Generated by `pnpm content:pending` (run it against production when it is lifted; the dev database has fictional examples):
the tracker lists parish identity, service times, EEC history, the confession of faith, the departments list, sacrament
procedures, the pastor's welcome message and the privacy policy as **À VALIDER**; the built-in French texts still carry 7
`À VALIDER` markers (identity signature, « soon » note, privacy paragraphs, parts of the admin hint); giving details, the
council, the history and the guides' wording are **missing** and show « bientôt » states by design.

## Suggestions for Phase 04
Sermons + podcast, bulletin and meditations, registrations, newsletter (when a domain exists), the Fête des Moissons campaign
page, PWA; home texts/figures as slots; a signed contact timestamp; `pg_trgm` for typo-tolerant search if people miss results;
a real-device pass (TalkBack, Android dial/geo links) and the production LCP and CPU readings once Joël lifts the dev-only rule.
